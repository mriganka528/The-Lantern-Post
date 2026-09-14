import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { DriveLink } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import type { Environment } from '../config/environment';
import { activeAccount } from '../account/account-access';
import type { DriveAccountCleanup } from '../account/account.service';
const scope = 'https://www.googleapis.com/auth/drive.appdata';
const nativeVerifierPrefix = 'native-google-android:';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const nativeStateHash = (state: string) => hash('native-google-android\0' + state);
export const backupOwnerKey = (ownerId: string) => hash('lantern-backup-owner\0' + ownerId);
export const MAX_BACKUP_BYTES = 14 * 1024 * 1024;
export interface EncryptedBackup { format: 'lantern-chat-backup'|'lantern-voice-backup'; version: 1; algorithm: 'AES-256-GCM'; data: string; }
export function validateEncryptedBackup(value: unknown): EncryptedBackup {
  if (!value || typeof value !== 'object') throw new BadRequestException('Invalid encrypted backup.');
  const e = value as Record<string, unknown>;
  if (Object.keys(e).sort().join(',') !== 'algorithm,data,format,version' || !['lantern-chat-backup','lantern-voice-backup'].includes(String(e.format)) || e.version !== 1 || e.algorithm !== 'AES-256-GCM' || typeof e.data !== 'string' || e.data.length < 40 || e.data.length > MAX_BACKUP_BYTES || !/^[A-Za-z0-9+/]+={0,2}$/.test(e.data)) throw new BadRequestException('Invalid encrypted backup.');
  return e as unknown as EncryptedBackup;
}
@Injectable()
export class DriveService implements DriveAccountCleanup {
  constructor(private prisma: PrismaService, private config: ConfigService<Environment, true>) {}
  private settings() { const settings = this.config.get('GOOGLE_DRIVE'); if (!settings) throw new ServiceUnavailableException({ code: 'DRIVE_UNCONFIGURED', message: 'Google Drive is not configured in this build.' }); return settings; }
  private async owner(subject: string) { const owner = await this.prisma.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: { id: true } }); if (!owner) throw new ConflictException('Account unavailable.'); return owner.id; }
  private seal(value: string, ownerId: string) { const key = this.settings().tokenKey; const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(Buffer.from(ownerId)); const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64'); }
  private unseal(value: string, ownerId: string) { const bytes = Buffer.from(value, 'base64'); const decipher = createDecipheriv('aes-256-gcm', this.settings().tokenKey, bytes.subarray(0,12)); decipher.setAuthTag(bytes.subarray(12,28)); decipher.setAAD(Buffer.from(ownerId)); return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8'); }
  protected async request(url: string, options: RequestInit = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (options.method==='DELETE' && response.status===404) return response;
    if (url==='https://oauth2.googleapis.com/revoke' && response.status===400) { const error=await response.clone().json().catch(()=>null) as {error?:string}|null; if(error?.error==='invalid_token') return response; }
    if (!response.ok) throw new ServiceUnavailableException({ code: response.status === 401 || response.status === 403 ? 'DRIVE_RECONNECT' : 'DRIVE_UNAVAILABLE', message: 'Google Drive could not complete this request.' }); return response;
  }
  async status(subject: string) { const id = await this.owner(subject); return { configured: Boolean(this.config.get('GOOGLE_DRIVE')), connected: Boolean(await this.prisma.driveConnection.findUnique({ where: { ownerId: id } })) }; }
  private async createLink(subject: string, native: boolean) {
    const ownerId = await this.owner(subject); const s = this.settings();
    const state = randomBytes(32).toString('base64url'); const verifier = (native ? nativeVerifierPrefix : '') + randomBytes(32).toString('base64url'); const id = randomUUID(); const expiresAt = new Date(Date.now()+600000);
    await this.prisma.$transaction(async tx => {
      await activeAccount(tx, ownerId);
      if (await tx.driveConnection.findUnique({ where: { ownerId } })) throw new ConflictException('Disconnect the current Drive account first.');
      await tx.driveLink.updateMany({ where: { ownerId, status: 'PENDING' }, data: { status: 'CANCELLED', encryptedVerifier: null } });
      await tx.driveLink.create({ data: { id, ownerId, stateHash: native ? nativeStateHash(state) : hash(state), encryptedVerifier: this.seal(verifier, ownerId), expiresAt } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { s, state, verifier, id, expiresAt };
  }
  async begin(subject: string) {
    const { s, state, verifier, id, expiresAt } = await this.createLink(subject, false);
    const query = new URLSearchParams({ client_id: s.clientId, redirect_uri: s.redirectUri, response_type: 'code', scope, access_type: 'offline', prompt: 'consent', state, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') });
    return { id, authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?' + query.toString(), expiresAt: expiresAt.toISOString() };
  }
  async beginNative(subject: string) {
    const { s, state, id, expiresAt } = await this.createLink(subject, true);
    // Public OAuth client ID only; Google issues the native grant to the
    // registered Android package/signing certificate. No client secret leaves.
    return { id, state, webClientId: s.clientId, scopes: [scope], expiresAt: expiresAt.toISOString() };
  }
  private async nativeLink(subject: string, id: string, state: string) {
    const ownerId = await this.owner(subject);
    const link = await this.prisma.driveLink.findFirst({ where: { id, ownerId, stateHash: nativeStateHash(state) } });
    if (!link) throw new NotFoundException('Connection unavailable.');
    return link;
  }
  async completeNative(subject: string, id: string, state: string, code: string) {
    const link = await this.nativeLink(subject, id, state);
    if (link.status === 'CONNECTED') return { connected: Boolean(await this.prisma.driveConnection.findUnique({ where: { ownerId: link.ownerId } })) };
    await this.completeLink(link, code, true);
    return { connected: true };
  }
  async cancelNative(subject: string, id: string, state: string) {
    const link = await this.nativeLink(subject, id, state);
    if (link.status === 'PENDING' && link.encryptedVerifier && !this.unseal(link.encryptedVerifier, link.ownerId).startsWith(nativeVerifierPrefix)) throw new BadRequestException('Connection unavailable.');
    const changed = await this.prisma.driveLink.updateMany({ where: { id: link.id, ownerId: link.ownerId, status: 'PENDING' }, data: { status: 'CANCELLED', encryptedVerifier: null } });
    return { cancelled: changed.count > 0 || link.status === 'CANCELLED' };
  }
  async callback(state: string, code?: string) {
    const link = await this.prisma.driveLink.findUnique({ where: { stateHash: hash(state) } });
    if (!link || link.status !== 'PENDING' || !link.encryptedVerifier || link.expiresAt.getTime() <= Date.now() || !code) throw new BadRequestException('This connection has expired.');
    await this.completeLink(link, code, false);
  }
  private async completeLink(link: DriveLink, code: string, native: boolean) {
    if (link.status !== 'PENDING' || !link.encryptedVerifier || link.expiresAt.getTime() <= Date.now() || !code) throw new BadRequestException('This connection has expired.');
    const s = this.settings(); let credential: string | undefined; let claimed=false;
    try {
      const verifier = this.unseal(link.encryptedVerifier, link.ownerId);
      if (native !== verifier.startsWith(nativeVerifierPrefix)) throw Error();
      const claim = await this.prisma.driveLink.updateMany({ where: { id: link.id, status: 'PENDING', encryptedVerifier: link.encryptedVerifier }, data: { encryptedVerifier: null, exchangingUntil:new Date(Date.now()+120000) } }); if (!claim.count) throw Error(); claimed=true;
      // Browser codes retain PKCE and the registered HTTPS redirect. Native
      // serverAuthCode grants use Google's installed-app exchange, with an
      // authenticated owner-bound one-use state; never mix the two protocols.
      const response = await this.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: s.clientId, client_secret: s.clientSecret, code, ...(native ? { redirect_uri: '' } : { redirect_uri: s.redirectUri, code_verifier: verifier }) }) });
      const token = await response.json() as { refresh_token?: string; access_token?: string; scope?: string };
      credential = token.refresh_token ?? token.access_token;
      if (typeof credential==='string' && credential.length<=10000) await this.prisma.driveLink.update({where:{id:link.id},data:{encryptedCleanupToken:this.seal(credential,link.ownerId)}});
      if (!token.refresh_token || typeof token.refresh_token !== 'string' || token.refresh_token.length > 10000 || !token.scope?.split(' ').includes(scope)) throw Error();
      await this.prisma.$transaction(async tx => { await activeAccount(tx, link.ownerId); const current = await tx.driveLink.findUnique({ where: { id: link.id } }); if (current?.status !== 'PENDING' || current.expiresAt.getTime() <= Date.now() || await tx.driveConnection.findUnique({ where: { ownerId: link.ownerId } })) throw Error(); await tx.driveConnection.create({ data: { ownerId: link.ownerId, encryptedRefreshToken: this.seal(token.refresh_token!, link.ownerId) } }); await tx.driveLink.update({ where: { id: link.id }, data: { status: 'CONNECTED', encryptedVerifier: null, encryptedCleanupToken:null, exchangingUntil:null } }); }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch {
      if(!claimed)throw new BadRequestException('This connection was already used.');
      let revoked=!credential;
      if (credential) try { await this.revoke(credential); revoked=true; } catch { /* Durable encrypted cleanup token remains for account erasure. */ }
      await this.prisma.driveLink.updateMany({ where: { id: link.id }, data: { status: 'FAILED', encryptedVerifier: null, exchangingUntil:null, ...(revoked?{encryptedCleanupToken:null}:{}) } }); throw new BadRequestException('The Drive connection could not be completed.');
    }
  }
  async linkStatus(subject: string, id: string) { const ownerId = await this.owner(subject); const link = await this.prisma.driveLink.findFirst({ where: { id, ownerId }, select: { status: true, expiresAt: true } }); if (!link) throw new NotFoundException(); return { status: link.status === 'PENDING' && link.expiresAt.getTime() <= Date.now() ? 'FAILED' : link.status }; }
  private async access(ownerId: string) {
    const s = this.settings(); const row = await this.prisma.driveConnection.findUnique({ where: { ownerId } }); if (!row) throw new ConflictException({ code: 'DRIVE_RECONNECT', message: 'Connect Google Drive first.' });
    const response = await this.request('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: s.clientId, client_secret: s.clientSecret, refresh_token: this.unseal(row.encryptedRefreshToken, ownerId) }) });
    const value = await response.json() as { access_token?: string }; if (!value.access_token || value.access_token.length > 10000) throw new ServiceUnavailableException(); return value.access_token;
  }
  private async files(ownerId: string, token: string) {
    const query = new URLSearchParams({ spaces: 'appDataFolder', q: `trashed = false and appProperties has { key='lanternOwner' and value='${backupOwnerKey(ownerId)}' }`, fields: 'files(id,name,modifiedTime,size),nextPageToken', pageSize: '100', orderBy: 'modifiedTime desc' });
    const response = await this.request('https://www.googleapis.com/drive/v3/files?' + query, { headers: { Authorization: 'Bearer ' + token } }); const value = await response.json() as { files?: { id: string; name: string; modifiedTime: string; size: string }[]; nextPageToken?: string };
    if (!Array.isArray(value.files) || value.nextPageToken) throw new ServiceUnavailableException('Too many backup files.'); return value.files;
  }
  async list(subject: string) { const ownerId = await this.owner(subject); const token = await this.access(ownerId); const files = await this.files(ownerId, token); return { files: files.map(f => ({ id: f.id, createdAt: f.modifiedTime, bytes: Number(f.size) })) }; }
  async upload(subject: string, value: unknown) {
    const ownerId = await this.owner(subject); const envelope = validateEncryptedBackup(value); const token = await this.access(ownerId); const current = await this.files(ownerId, token);
    if (current.length >= 10) throw new ConflictException({ code: 'BACKUP_LIMIT', message: 'Remove an older Drive backup before adding another.' });
    // Account erasure waits for a started provider write and its ambiguity window.
    const activeUntil=new Date(Date.now()+120000);
    await this.prisma.$transaction(async tx=>{await activeAccount(tx,ownerId);const claim=await tx.driveConnection.updateMany({where:{ownerId,OR:[{activeUntil:null},{activeUntil:{lt:new Date()}}]},data:{activeUntil}});if(!claim.count)throw new ConflictException('A Drive operation is still finishing.');},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    const boundary = 'lantern_' + randomUUID(); const metadata = { name: envelope.format==='lantern-voice-backup'?'Lantern Post voice backup.lanternbackup':'Lantern Post chat backup.lanternbackup', parents: ['appDataFolder'], appProperties: { lanternOwner: backupOwnerKey(ownerId) } };
    const response = await this.request('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime,size', { method: 'POST', headers: { Authorization: 'Bearer '+token, 'Content-Type': 'multipart/related; boundary='+boundary }, body: '--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(envelope)+'\r\n--'+boundary+'--' });
    const file = await response.json() as { id: string };
    try { await this.prisma.$transaction(tx => activeAccount(tx, ownerId)); }
    catch { if (file.id) await this.deleteFile(file.id, token).catch(() => {}); throw new ConflictException('Account is closing.'); }
    await this.prisma.driveConnection.updateMany({where:{ownerId,activeUntil},data:{activeUntil:null}});return { id: file.id };
  }
  async download(subject: string, id: string) { const ownerId = await this.owner(subject); const token = await this.access(ownerId); const file = (await this.files(ownerId, token)).find(f => f.id === id); if (!file) throw new NotFoundException(); if (Number(file.size) > MAX_BACKUP_BYTES + 1000) throw new BadRequestException('Backup is too large.'); const response = await this.request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?alt=media', { headers: { Authorization: 'Bearer '+token } }); const reader=response.body?.getReader();if(!reader)throw new BadRequestException('Backup unavailable.');let bytes=0;const chunks:Uint8Array[]=[];try{while(true){const item=await reader.read();if(item.done)break;bytes+=item.value.length;if(bytes>MAX_BACKUP_BYTES+1000){await reader.cancel();throw new BadRequestException('Backup is too large.');}chunks.push(item.value);}}finally{reader.releaseLock();}const text=Buffer.concat(chunks).toString('utf8');await this.prisma.$transaction(tx => activeAccount(tx, ownerId)); return validateEncryptedBackup(JSON.parse(text)); }
  private async deleteFile(id: string, token: string) { await this.request('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id), { method: 'DELETE', headers: { Authorization: 'Bearer '+token } }); }
  async remove(subject: string, id: string) { const ownerId = await this.owner(subject); const token = await this.access(ownerId); if (!(await this.files(ownerId, token)).some(file => file.id === id)) throw new NotFoundException(); await this.deleteFile(id, token); return { removed: true }; }
  private async revoke(token: string) { await this.request('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }) }); }
  async disconnect(subject: string) { const id = await this.owner(subject); await this.disconnectOwner(id); return { connected: false }; }
  private async disconnectOwner(ownerId: string) { const row = await this.prisma.driveConnection.findUnique({ where: { ownerId } }); if (!row) return; if(row.activeUntil && row.activeUntil.getTime()>Date.now())throw new ConflictException('A backup is still finishing.');await this.revoke(this.unseal(row.encryptedRefreshToken, ownerId)); await this.prisma.driveConnection.deleteMany({ where: { ownerId, encryptedRefreshToken: row.encryptedRefreshToken } }); }
  async eraseOwner(ownerId: string) {
    const links=await this.prisma.driveLink.findMany({where:{ownerId}});
    if(links.some(link=>link.exchangingUntil && link.exchangingUntil.getTime()>Date.now()))throw new ConflictException('A connection is still finishing.');
    const row = await this.prisma.driveConnection.findUnique({ where: { ownerId } });
    if(row){if(row.activeUntil && row.activeUntil.getTime()>Date.now())throw new ConflictException('A backup is still finishing.');const token=await this.access(ownerId);for(const file of await this.files(ownerId,token))await this.deleteFile(file.id,token);await this.disconnectOwner(ownerId);}
    for(const link of links)if(link.encryptedCleanupToken){await this.revoke(this.unseal(link.encryptedCleanupToken,ownerId));await this.prisma.driveLink.update({where:{id:link.id},data:{encryptedCleanupToken:null}});}
  }
}
