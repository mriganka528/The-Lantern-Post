import { activeAccount } from '../account/account-access';
import { ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { VoiceAsset } from '@prisma/client';
import type { VoiceUploadGrant, VoiceUploadRequest, WorldVoiceUploadRequest } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { correspondent } from '../letters/private-letter-contract';
import { VoiceStorageService } from './voice-storage.service';
import { inspectVoice } from './audio-validation';
import type { VoiceMime } from './voice-limits';
const hash = (owner: string, request: string) => createHash('sha256').update(`${owner}\0${request.toLowerCase()}`).digest('hex');
export const voiceAssetId = (owner: string, request: string) => `voice_${hash(owner, request)}`;
const incomingKey = (key: string) => key.replace(/^voice\/sealed\//, 'voice/incoming/');
@Injectable()
export class VoiceAssetsService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined; private cleaning = false;
  constructor(private readonly prisma: PrismaService, readonly storage: VoiceStorageService) {}
  onModuleInit() { if (this.storage.available) { this.timer = setInterval(() => { void this.cleanup().catch(() => {}); }, 60_000); this.timer.unref(); } }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }); }
      catch (error) { if (error instanceof HttpException) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034', 'P2025'].includes(error.code) && attempt < 3) continue; throw new ServiceUnavailableException({ code: 'VOICE_STORAGE_UNAVAILABLE', message: 'The recording could not be prepared.' }); }
    }
    throw new ServiceUnavailableException();
  }
  private async owner(subject: string) {
    const owner = await this.prisma.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: { id: true, characterId: true } });
    if (!owner?.characterId) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose your username and companion first.' }); return owner;
  }
  async create(subject: string, input: VoiceUploadRequest | WorldVoiceUploadRequest): Promise<VoiceUploadGrant> {
    const owner = await this.owner(subject);
    const destinationType = 'destinationType' in input ? 'INFINITY' as const : 'FRIEND' as const;
    const recipientId = 'recipientId' in input ? input.recipientId : null;
    if (!this.storage.available) throw new ServiceUnavailableException({ code: 'VOICE_STORAGE_UNAVAILABLE', message: 'Voice delivery is resting for now.' });
    const id = voiceAssetId(owner.id, input.requestId);
    const asset = await this.transaction(async tx => {
      await activeAccount(tx, owner.id);
      const receipt = destinationType === 'INFINITY' ? await tx.worldReceipt.findUnique({ where: { id: `world_${hash(owner.id, input.requestId)}` } }) : await tx.deliveryReceipt.findUnique({ where: { id: `delivery_${hash(owner.id, input.requestId)}` } });
      if (receipt) throw new ConflictException({ code: 'VOICE_OPERATION_FINISHED', message: 'Check this delivery’s saved outcome.' });
      if (destinationType === 'FRIEND') {
        const friend = await tx.user.findFirst({ where: { id: recipientId!, characterId: { not: null }, ...correspondent(owner.id) }, select: { id: true } });
        if (!friend || friend.id === owner.id) throw new NotFoundException({ code: 'FRIEND_UNAVAILABLE', message: 'This friendship gate is unavailable.' });
      }
      const old = await tx.voiceAsset.findUnique({ where: { id } });
      if (old) {
        if (old.status === 'DELETED' || old.status === 'ATTACHED' || old.expiresAt.getTime() <= Date.now()) throw new ConflictException({ code: 'VOICE_UPLOAD_EXPIRED', message: 'Cancel this delivery and start again with the saved recording.' });
        if (old.destinationType !== destinationType || old.recipientId !== recipientId || old.mimeType !== input.mimeType || old.byteLength !== input.byteLength || old.sha256 !== input.sha256 || Math.abs(old.durationMs - input.durationMs) > 1500) throw new ConflictException({ code: 'VOICE_UPLOAD_MISMATCH', message: 'This recording does not match its delivery.' });
        return old;
      }
      const [pending, daily] = await Promise.all([
        tx.voiceAsset.count({ where: { ownerId: owner.id, status: { in: ['UPLOADING', 'READY'] }, expiresAt: { gt: new Date() } } }),
        tx.voiceAsset.count({ where: { ownerId: owner.id, createdAt: { gte: new Date(Date.now() - 86_400_000) } } }),
      ]);
      if (pending >= 3 || daily >= 50) throw new ConflictException({ code: 'VOICE_UPLOAD_LIMIT', message: 'Finish or cancel another voice delivery before starting this one.' });
      const budget=this.storage.budgetBytes;
      if(budget){
        const stage=await tx.voiceAsset.aggregate({where:{stageClearedAt:null},_sum:{byteLength:true}});
        const sealed=await tx.voiceAsset.aggregate({where:{OR:[{status:{not:'DELETED'}},{contentClearedAt:null}]},_sum:{byteLength:true}});
        if((stage._sum.byteLength??0)+(sealed._sum.byteLength??0)+input.byteLength*2>budget)throw new ConflictException({code:'VOICE_STORAGE_FULL',message:'The recording cabinet is full for now. Your voice letter is kept on this device.'});
      }
      return tx.voiceAsset.create({ data: { id, ownerId: owner.id, recipientId, destinationType, requestId: input.requestId.toLowerCase(), storageKey: `voice/sealed/${id}`, mimeType: input.mimeType, byteLength: input.byteLength, durationMs: input.durationMs, sha256: input.sha256, expiresAt: new Date(Date.now() + 900_000) } });
    });
    if (asset.status === 'READY') return { assetId: id, uploadUrl: null, expiresAt: asset.expiresAt.toISOString() };
    const grant = this.storage.upload(incomingKey(asset.storageKey), asset.byteLength, asset.mimeType as VoiceMime, Math.min(600, Math.floor((asset.expiresAt.getTime() - Date.now()) / 1000)));
    return { assetId: id, uploadUrl: grant.url, expiresAt: grant.expiresAt.toISOString(),...(grant.viaApi?{uploadViaApi:true}:{}) };
  }
  async proxyUploadTicket(subject:string,id:string) {
    if(!this.storage.proxyUploads)throw new NotFoundException();
    const owner=await this.owner(subject);
    return this.transaction(async tx=>{
      await activeAccount(tx,owner.id);const asset=await tx.voiceAsset.findFirst({where:{id,ownerId:owner.id,status:'UPLOADING',expiresAt:{gt:new Date()}}});
      if(!asset)throw new NotFoundException('This upload is no longer available.');
      if(asset.destinationType==='FRIEND'&&!await tx.user.findFirst({where:{id:asset.recipientId!,characterId:{not:null},...correspondent(owner.id)}}))throw new NotFoundException('This friendship gate is unavailable.');
      const receipt=asset.destinationType==='INFINITY'?await tx.worldReceipt.findUnique({where:{id:`world_${hash(owner.id,asset.requestId)}`}}):await tx.deliveryReceipt.findUnique({where:{id:`delivery_${hash(owner.id,asset.requestId)}`}});
      if(receipt)throw new ConflictException({code:'VOICE_OPERATION_FINISHED',message:'Check this delivery’s saved outcome.'});
      // Cleanup must not finish while a bounded API upload can still write its
      // incoming object. No long-lived provider upload token leaves the server.
      const minimum=new Date(Date.now()+120000);if(asset.expiresAt<minimum)await tx.voiceAsset.update({where:{id},data:{expiresAt:minimum}});
      return asset;
    });
  }
  async receiveProxyUpload(subject:string,id:string,bytes:Uint8Array,ticket?:VoiceAsset) {
    const asset=ticket??await this.proxyUploadTicket(subject,id);
    if(bytes.length!==asset.byteLength||createHash('sha256').update(bytes).digest('base64')!==asset.sha256)throw new ConflictException({code:'VOICE_INVALID',message:'The recording upload did not match. Your original recording is still on this device.'});
    let durationMs:number;try{durationMs=inspectVoice(bytes,asset.mimeType as VoiceMime);if(Math.abs(durationMs-asset.durationMs)>1500)throw Error();}catch{throw new ConflictException({code:'VOICE_INVALID',message:'This recording could not be checked. Cancel and record a fresh take.'});}
    try {
      await this.storage.put(incomingKey(asset.storageKey),bytes,asset.mimeType as VoiceMime);
      await this.storage.put(asset.storageKey,bytes,asset.mimeType as VoiceMime);
      await this.transaction(async tx=>{await activeAccount(tx,asset.ownerId);const current=await tx.voiceAsset.findFirst({where:{id,ownerId:asset.ownerId,status:'UPLOADING',expiresAt:{gt:new Date()}}});if(!current)throw new NotFoundException('This upload is no longer available.');if(current.destinationType==='FRIEND'&&!await tx.user.findFirst({where:{id:current.recipientId!,...correspondent(asset.ownerId)}}))throw new NotFoundException();await tx.voiceAsset.update({where:{id},data:{status:'READY',durationMs}});});
      return {assetId:id,uploaded:true,ready:true};
    }catch(error){
      await this.prisma.voiceAsset.updateMany({where:{id,ownerId:asset.ownerId,status:'DELETED'},data:{stageClearedAt:null,contentClearedAt:null,purgeAfter:new Date()}});throw error;
    }
  }
  async finish(subject: string, id: string) {
    const owner = await this.owner(subject); const asset = await this.prisma.voiceAsset.findFirst({ where: { id, ownerId: owner.id } });
    if (!asset) throw new NotFoundException();
    if (asset.status === 'READY' || asset.status === 'ATTACHED') return { assetId: id, durationMs: asset.durationMs };
    if (asset.status !== 'UPLOADING' || asset.expiresAt.getTime() <= Date.now()) throw new ConflictException({ code: 'VOICE_UPLOAD_EXPIRED', message: 'This upload has expired.' });
    const bytes = await this.storage.read(incomingKey(asset.storageKey), asset.byteLength);
    let durationMs: number;
    try {
      if (createHash('sha256').update(bytes).digest('base64') !== asset.sha256) throw new Error('Checksum mismatch');
      durationMs = inspectVoice(bytes, asset.mimeType as VoiceMime);
      if (Math.abs(durationMs - asset.durationMs) > 1500) throw new Error('Duration mismatch');
    } catch { await this.prisma.voiceAsset.updateMany({ where: { id, ownerId: owner.id, status: 'UPLOADING' }, data: { status: 'DELETED', sha256: null, purgeAfter: new Date() } }); throw new ConflictException({ code: 'VOICE_INVALID', message: 'This recording could not be checked. Cancel and record a fresh take.' }); }
    // Only the incoming key has a client upload grant. Copy checked bytes to
    // a sealed key so a late/replayed PUT cannot replace approved audio.
    try {
      await this.storage.put(asset.storageKey, bytes, asset.mimeType as VoiceMime);
      return await this.transaction(async tx => {
      await activeAccount(tx, owner.id);
        const current = await tx.voiceAsset.findUnique({ where: { id } });
        if (!current || current.status === 'DELETED' || current.expiresAt.getTime() <= Date.now()) throw new ConflictException({ code: 'VOICE_UPLOAD_EXPIRED', message: 'This delivery is no longer accepting an upload.' });
        if (current.status === 'UPLOADING') await tx.voiceAsset.update({ where: { id }, data: { status: 'READY', durationMs } });
        return { assetId: id, durationMs };
      });
    } catch (error) {
      // A cancellation's cleanup may have run while the private copy was in
      // flight. Requeue removal so that late completion cannot leave a blob.
      await this.prisma.voiceAsset.updateMany({ where: { id, ownerId: owner.id, status: 'DELETED' }, data: { contentClearedAt: null, purgeAfter: new Date() } });
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException({ code: 'VOICE_STORAGE_UNAVAILABLE', message: 'The checked recording could not be kept.' });
    }
  }
  async checkedBytes(ownerId: string, requestId: string, recipientId: string | null, id: string) {
    if (id !== voiceAssetId(ownerId, requestId)) return null;
    const asset = await this.prisma.voiceAsset.findFirst({ where: { id, ownerId, recipientId, destinationType: recipientId === null ? 'INFINITY' : 'FRIEND', status: 'READY', expiresAt: { gt: new Date() } } });
    if (!asset) return null;
    const bytes = await this.storage.read(asset.storageKey, asset.byteLength);
    if (createHash('sha256').update(bytes).digest('base64') !== asset.sha256) throw new ServiceUnavailableException('The recording could not be verified.');
    return { asset, bytes };
  }
  retire(tx: Prisma.TransactionClient, ownerId: string, requestId: string, destinationType: 'FRIEND' | 'INFINITY' = 'FRIEND') {
    return tx.voiceAsset.updateMany({ where: { id: voiceAssetId(ownerId, requestId), ownerId, destinationType, status: { in: ['UPLOADING', 'READY'] } }, data: { status: 'DELETED', sha256: null, purgeAfter: new Date() } });
  }
  async cleanup() {
    if (!this.storage.available || this.cleaning) return; this.cleaning = true;
    try {
      const now = new Date();
      await this.prisma.voiceAsset.updateMany({ where: { status: { in: ['UPLOADING', 'READY'] }, expiresAt: { lte: now } }, data: { status: 'DELETED', sha256: null, purgeAfter: now } });
      const assets = await this.prisma.voiceAsset.findMany({ where: { OR: [{ status: 'DELETED', contentClearedAt: null, purgeAfter: { lte: now } }, { stageClearedAt: null, expiresAt: { lte: now } }] }, take: 10 });
      for (const asset of assets) {
        try {
          if (asset.status === 'DELETED' && !asset.contentClearedAt) { await this.storage.remove(asset.storageKey); await this.prisma.voiceAsset.update({ where: { id: asset.id }, data: { contentClearedAt: new Date() } }); }
          if (!asset.stageClearedAt && asset.expiresAt <= now) { await this.storage.remove(incomingKey(asset.storageKey)); await this.prisma.voiceAsset.update({ where: { id: asset.id }, data: { stageClearedAt: new Date() } }); }
        } catch { /* Private keys remain inaccessible; retry without logging signed URLs. */ }
      }
    } finally { this.cleaning = false; }
  }
}
