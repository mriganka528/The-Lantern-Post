import { combinedReview, reviewMetadata } from '../letters/content-review';
import type { ContentDecision } from '../letters/content-review';
import { activeAccount } from '../account/account-access';
import { ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { WorldBounds, WorldCapabilities, WorldLetter, WorldLetterRequest, WorldPage, WorldReceipt, WorldRejection } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { LetterModerationService } from '../letters/letter-moderation.service';
import { moderationDecision } from '../letters/moderation-deadline';
import { stationerySnapshot } from '../letters/private-letter-contract';
import { serializePreset } from '../presets/preset';
import { VoiceAssetsService, voiceAssetId } from '../voice/voice-assets.service';
import type { VoiceMime } from '../voice/voice-limits';
import { publicLetters, star, starSelect, worldPagination } from './infinity-contract';
export const worldOperationId = (ownerId: string, requestId: string) => `world_${createHash('sha256').update(`${ownerId}\0${requestId.toLowerCase()}`).digest('hex')}`;
const receiptSelect = { id: true, outcome: true, reason: true, isSigned: true, letterId: true, createdAt: true } as const;
const receipt = (row: Prisma.WorldReceiptGetPayload<{ select: typeof receiptSelect }>, requestId: string): WorldReceipt => ({ requestId: requestId.toLowerCase(), receiptId: row.id, outcome: row.outcome, reason: row.reason as WorldRejection | null, isSigned: row.isSigned, letterId: row.letterId, completedAt: row.createdAt.toISOString() });
@Injectable()
export class InfinityService {
  constructor(private readonly prisma: PrismaService, private readonly moderation: LetterModerationService, private readonly voice: VoiceAssetsService) {}
  capabilities(): WorldCapabilities { return { textAvailable: this.moderation.available, voiceAvailable: Boolean(this.moderation.voiceAvailable && this.voice.storage.available) }; }
  private async owner(subject: string) { const owner = await this.prisma.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: { id: true, characterId: true } }); if (!owner?.characterId) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose your username and companion first.' }); return owner; }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }); }
    catch (error) { if (error instanceof HttpException) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034', 'P2025'].includes(error.code) && attempt < 3) continue; throw new ServiceUnavailableException({ code: 'WORLD_UNCONFIRMED', message: 'The sky could not confirm this letter. Check its saved outcome.' }); }
    throw new ServiceUnavailableException();
  }
  async status(subject: string, requestId: string) { const owner = await this.owner(subject); const row = await this.prisma.worldReceipt.findUnique({ where: { id: worldOperationId(owner.id, requestId) }, select: receiptSelect }); return row ? receipt(row, requestId) : null; }
  private async gate(tx: Prisma.TransactionClient, ownerId: string, input: WorldLetterRequest) {
    await activeAccount(tx, ownerId);
    const row = await tx.preset.findUnique({ where: { id: input.presetId }, select: { id: true, key: true, displayName: true, configJson: true, isActive: true } }); const preset = row?.isActive ? serializePreset(row) : null;
    if (!preset) return { preset: null, reason: 'PRESET_UNAVAILABLE' as const };
    if (input.type === 'VOICE' && (input.voiceAssetId !== voiceAssetId(ownerId, input.requestId) || !await tx.voiceAsset.findFirst({ where: { id: input.voiceAssetId, ownerId, destinationType: 'INFINITY', recipientId: null, status: 'READY', expiresAt: { gt: new Date() } } }))) return { preset: null, reason: 'VOICE_UNAVAILABLE' as const };
    const count = await tx.worldReceipt.count({ where: { ownerId, outcome: 'DELIVERED', createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    return { preset, reason: count >= 20 ? 'DELIVERY_LIMIT' as const : null };
  }
  async send(subject: string, input: WorldLetterRequest): Promise<WorldReceipt> {
    const owner = await this.owner(subject); const id = worldOperationId(owner.id, input.requestId);
    const reject = async (tx: Prisma.TransactionClient, reason: WorldRejection) => { if (input.type === 'VOICE') await this.voice.retire(tx, owner.id, input.requestId, 'INFINITY'); return tx.worldReceipt.create({ data: { id, ownerId: owner.id, isSigned: input.isSigned, outcome: 'REJECTED', reason }, select: receiptSelect }); };
    const prior = this.moderation.disabled ? null : await this.transaction(async tx => { const old = await tx.worldReceipt.findUnique({ where: { id }, select: receiptSelect }); if (old) return old; const gate = await this.gate(tx, owner.id, input); return gate.reason ? reject(tx, gate.reason) : null; });
    if (prior) return receipt(prior, input.requestId);
    let decision: ContentDecision;
    try { decision = this.moderation.disabled ? 'NOT_REQUIRED' : await moderationDecision(async signal => {
      if (input.type === 'TEXT') return this.moderation.check(input.textContent, signal);
      const audio = await this.voice.checkedBytes(owner.id, input.requestId, null, input.voiceAssetId); if (!audio) throw new Error('Missing recording'); signal.throwIfAborted();
      const decision = await this.moderation.checkVoice({ bytes: audio.bytes, mimeType: audio.asset.mimeType, durationMs: audio.asset.durationMs }, signal);
      if (decision === 'REJECTED' || !input.voiceCaption) return decision;
      signal.throwIfAborted(); return combinedReview(decision, await this.moderation.check(input.voiceCaption, signal));
    }); } catch { throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'Public sharing is resting. Your letter has not been shared.' }); }
    const result = await this.transaction(async tx => {
      const old = await tx.worldReceipt.findUnique({ where: { id }, select: receiptSelect }); if (old) return old;
      const gate = await this.gate(tx, owner.id, input); if (gate.reason) return reject(tx, gate.reason); if (decision === 'REJECTED' || !gate.preset) return reject(tx, 'CONTENT_NOT_ALLOWED');
      const now = new Date(); const asset = input.type === 'VOICE' ? await tx.voiceAsset.findUnique({ where: { id: input.voiceAssetId } }) : null;
      const letter = await tx.letter.create({ data: { id: `star_${randomUUID()}`, senderId: owner.id, recipientId: null, type: input.type, destinationType: 'INFINITY', status: 'DELIVERED', textContent: input.type === 'TEXT' ? input.textContent : null, voiceAssetId: asset?.id ?? null, audioDurationMs: asset?.durationMs ?? null,
        voiceCaption: input.type === 'VOICE' ? input.voiceCaption ?? null : null, isSigned: input.isSigned, posX: randomInt(90, 1511), posY: randomInt(100, 851), presetId: input.presetId, stationeryJson: gate.preset as unknown as Prisma.InputJsonValue, ...reviewMetadata(decision), moderationCheckedAt: decision === 'APPROVED' ? now : null, deliveredAt: now }, select: { id: true } });
      if (asset) await tx.voiceAsset.update({ where: { id: asset.id }, data: { status: 'ATTACHED' } });
      // Public activity deliberately creates no notifications.
      return tx.worldReceipt.create({ data: { id, ownerId: owner.id, outcome: 'DELIVERED', isSigned: input.isSigned, letterId: letter.id, createdAt: now }, select: receiptSelect });
    }); return receipt(result, input.requestId);
  }
  async cancel(subject: string, requestId: string, isSigned: boolean) { const owner = await this.owner(subject); const id = worldOperationId(owner.id, requestId);
    return receipt(await this.transaction(async tx => { const old = await tx.worldReceipt.findUnique({ where: { id }, select: receiptSelect }); if (old) return old; await this.voice.retire(tx, owner.id, requestId, 'INFINITY'); return tx.worldReceipt.create({ data: { id, ownerId: owner.id, outcome: 'REJECTED', reason: 'CANCELLED', isSigned }, select: receiptSelect }); }), requestId);
  }
  async list(subject: string, bounds: WorldBounds | null, cursor?: string): Promise<WorldPage> {
    const owner = await this.owner(subject); const page = worldPagination(bounds, cursor);
    const rows = await this.prisma.letter.findMany({ where: { AND: [publicLetters(owner.id), page.where, ...(bounds ? [] : [{ senderId: owner.id }])] }, select: starSelect, take: 61, orderBy: [{ deliveredAt: 'desc' }, { id: 'desc' }] });
    const visible = rows.slice(0, 60); return { stars: visible.map(star), nextCursor: rows.length > 60 ? page.cursor(visible[visible.length - 1]!) : null };
  }
  async open(subject: string, id: string): Promise<WorldLetter> {
    const owner = await this.owner(subject);
    const row = await this.prisma.letter.findFirst({ where: { AND: [publicLetters(owner.id), { id }] }, select: { ...starSelect, senderId: true, isSigned: true, sender: { select: { username: true } }, textContent: true, voiceCaption: true, stationeryJson: true, voiceAsset: true } });
    const preset = row ? stationerySnapshot(row.stationeryJson) : null; if (!row || !preset) throw new NotFoundException({ code: 'LETTER_UNAVAILABLE', message: 'This light is no longer available.' });
    const grant = row.type === 'VOICE' && row.voiceAsset ? await this.voice.storage.playback(row.voiceAsset.storageKey) : null;
    if(grant)await this.transaction(async tx=>{await activeAccount(tx,owner.id);if(!await tx.letter.findFirst({where:{AND:[publicLetters(owner.id),{id,voiceAssetId:row.voiceAsset?.id}]},select:{id:true}}))throw new NotFoundException({code:'LETTER_UNAVAILABLE',message:'This light is no longer available.'});});
    return { ...star(row), preset, textContent: row.type === 'TEXT' ? row.textContent : null, audio: grant && row.voiceAsset ? { url: grant.url, expiresAt: grant.expiresAt.toISOString(), mimeType: row.voiceAsset.mimeType as VoiceMime, durationMs: row.voiceAsset.durationMs, caption: row.voiceCaption } : null,
      signature: row.isSigned ? row.sender.username : null, deliveredAt: row.deliveredAt!.toISOString(), mine: row.senderId === owner.id };
  }
  async remove(subject: string, id: string) { const owner = await this.owner(subject); await this.transaction(async tx => {
    const row = await tx.letter.findFirst({ where: { id, senderId: owner.id, destinationType: 'INFINITY' }, select: { id: true, voiceAssetId: true } }); if (!row) throw new NotFoundException();
    await tx.letter.update({ where: { id }, data: { status: 'HARD_DELETED', textContent: null, voiceCaption: null, audioUrl: null, audioDurationMs: null, voiceAssetId: null, stationeryJson: Prisma.DbNull, moderationPassed: null, posX: null, posY: null, softDeletedAt: new Date(), hardDeleteAfter: new Date() } });
    if (row.voiceAssetId) await tx.voiceAsset.update({ where: { id: row.voiceAssetId }, data: { status: 'DELETED', sha256: null, purgeAfter: new Date() } });
  }); return { deleted: true as const }; }
}
