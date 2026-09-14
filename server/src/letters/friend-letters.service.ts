import { PalaceEvents } from '../realtime/palace-events';
import { Optional } from '@nestjs/common';
import { combinedReview, reviewMetadata } from './content-review';
import type { ContentDecision } from './content-review';
import { activeAccount } from '../account/account-access';
import { ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { DeliveryReceipt, DeliveryRejection, FriendLetterRequest, LetterBox, LetterBoxPage, LetterBoxSummary, OpenedFriendLetter } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { serializePreset } from '../presets/preset';
import { LetterModerationService } from './letter-moderation.service';
import { correspondent, envelope, letterBoundary, letterCursor, letterSelect, privateLetters } from './private-letter-contract';
import { VoiceAssetsService, voiceAssetId } from '../voice/voice-assets.service';
import type { VoiceMime } from '../voice/voice-limits';
import { moderationDecision } from './moderation-deadline';

const receiptSelect = { id: true, recipientId: true, outcome: true, reason: true, letterId: true, createdAt: true } as const;
type ReceiptRow = Prisma.DeliveryReceiptGetPayload<{ select: typeof receiptSelect }>;
const operationId = (ownerId: string, requestId: string) => `delivery_${createHash('sha256').update(`${ownerId}\0${requestId.toLowerCase()}`).digest('hex')}`;
const reasons: DeliveryRejection[] = ['FRIEND_UNAVAILABLE', 'PRESET_UNAVAILABLE', 'CONTENT_NOT_ALLOWED', 'DELIVERY_LIMIT', 'VOICE_UNAVAILABLE', 'CANCELLED'];
function receipt(row: ReceiptRow, requestId: string): DeliveryReceipt {
  if (row.outcome === 'DELIVERED' ? row.reason !== null || !row.letterId : row.letterId !== null || !reasons.includes(row.reason as DeliveryRejection)) throw new ServiceUnavailableException('The delivery could not be confirmed.');
  return { requestId: requestId.toLowerCase(), receiptId: row.id, recipientId: row.recipientId, outcome: row.outcome, reason: row.reason as DeliveryRejection | null, letterId: row.letterId, completedAt: row.createdAt.toISOString() };
}
@Injectable()
export class FriendLettersService {
  constructor(private readonly prisma: PrismaService, private readonly moderation: LetterModerationService, private readonly voice: VoiceAssetsService, @Optional() private events?: PalaceEvents) {}
  capabilities() { return { textAvailable: this.moderation.available, voiceAvailable: Boolean(this.moderation.voiceAvailable && this.voice.storage.available), voiceStorageAvailable: this.voice.storage.available }; }
  private async owner(subject: string) {
    const owner = await this.prisma.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: { id: true, characterId: true } });
    if (!owner) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose a username first.' });
    if (!owner.characterId) throw new ConflictException({ code: 'CHARACTER_REQUIRED', message: 'Choose a companion first.' });
    return owner;
  }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10_000 }); }
      catch (error) {
        if (error instanceof HttpException) throw error;
        if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034', 'P2025'].includes(error.code) && attempt < 3) continue;
        throw new ServiceUnavailableException({ code: 'DELIVERY_UNCONFIRMED', message: 'The delivery could not be confirmed. Check its status before trying again.' });
      }
    }
    throw new ServiceUnavailableException();
  }
  async status(subject: string, requestId: string): Promise<DeliveryReceipt | null> {
    const owner = await this.owner(subject);
    const row = await this.prisma.deliveryReceipt.findUnique({ where: { id: operationId(owner.id, requestId) }, select: receiptSelect });
    return row ? receipt(row, requestId) : null;
  }
  private async gate(tx: Prisma.TransactionClient, ownerId: string, input: FriendLetterRequest) {
    await activeAccount(tx, ownerId);
    const friend = input.recipientId === ownerId ? null : await tx.user.findFirst({ where: { id: input.recipientId, characterId: { not: null }, ...correspondent(ownerId) }, select: { id: true } });
    if (!friend) return { reason: 'FRIEND_UNAVAILABLE' as const, preset: null };
    const row = await tx.preset.findUnique({ where: { id: input.presetId }, select: { id: true, key: true, displayName: true, configJson: true, isActive: true } });
    const preset = row?.isActive ? serializePreset(row) : null;
    if (!preset) return { reason: 'PRESET_UNAVAILABLE' as const, preset: null };
    if (input.type === 'VOICE') {
      const asset = input.voiceAssetId === voiceAssetId(ownerId, input.requestId) ? await tx.voiceAsset.findFirst({ where: { id: input.voiceAssetId, ownerId, destinationType: 'FRIEND', recipientId: input.recipientId, status: 'READY', expiresAt: { gt: new Date() } } }) : null;
      if (!asset) return { reason: 'VOICE_UNAVAILABLE' as const, preset: null };
    }
    const recent = await tx.deliveryReceipt.count({ where: { ownerId, outcome: 'DELIVERED', createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    return { reason: recent >= 50 ? 'DELIVERY_LIMIT' as const : null, preset };
  }
  async send(subject: string, input: FriendLetterRequest): Promise<DeliveryReceipt> {
    const owner = await this.owner(subject); const id = operationId(owner.id, input.requestId);
    const preflight = this.moderation.disabled ? null : await this.transaction(async tx => {
      const existing = await tx.deliveryReceipt.findUnique({ where: { id }, select: receiptSelect });
      if (existing) return existing;
      const gate = await this.gate(tx, owner.id, input);
      if (!gate.reason) return null;
      if (input.type === 'VOICE') await this.voice.retire(tx, owner.id, input.requestId);
      return tx.deliveryReceipt.create({ data: { id, ownerId: owner.id, recipientId: input.recipientId, outcome: 'REJECTED', reason: gate.reason }, select: receiptSelect });
    });
    if (preflight) return receipt(preflight, input.requestId);
    // The server chooses whether review is required. Access and receipt checks
    // still run again in the transaction before a confirmed delivery is saved.
    let decision: ContentDecision;
    try {
      decision = this.moderation.disabled ? 'NOT_REQUIRED' : await moderationDecision(async signal => {
        if (input.type === 'TEXT') return this.moderation.check(input.textContent, signal);
        const recording = await this.voice.checkedBytes(owner.id, input.requestId, input.recipientId, input.voiceAssetId);
        if (!recording) throw new Error('Voice unavailable');
        signal.throwIfAborted();
        const decision = await this.moderation.checkVoice({ bytes: recording.bytes, mimeType: recording.asset.mimeType, durationMs: recording.asset.durationMs }, signal);
        if (decision === 'REJECTED' || !input.voiceCaption) return decision;
        signal.throwIfAborted(); return combinedReview(decision, await this.moderation.check(input.voiceCaption, signal));
      });
    }
    catch { throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'The letter check is unavailable. Your letter has not been delivered.' }); }
    if (decision !== 'APPROVED' && decision !== 'REJECTED' && decision !== 'NOT_REQUIRED') throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'The letter check is unavailable.' });
    const result = await this.transaction(async tx => {
      const existing = await tx.deliveryReceipt.findUnique({ where: { id }, select: receiptSelect }); if (existing) return existing;
      const gate = await this.gate(tx, owner.id, input);
      const reason = gate.reason ?? (decision === 'REJECTED' ? 'CONTENT_NOT_ALLOWED' as const : null);
      if (reason || !gate.preset) {
        if (input.type === 'VOICE') await this.voice.retire(tx, owner.id, input.requestId);
        return tx.deliveryReceipt.create({ data: { id, ownerId: owner.id, recipientId: input.recipientId, outcome: 'REJECTED', reason: reason ?? 'PRESET_UNAVAILABLE' }, select: receiptSelect });
      }
      const now = new Date();
      const asset = input.type === 'VOICE' ? await tx.voiceAsset.findUnique({ where: { id: input.voiceAssetId } }) : null;
      const letter = await tx.letter.create({ data: { id, senderId: owner.id, recipientId: input.recipientId, type: input.type, destinationType: 'FRIEND', status: 'DELIVERED',
        textContent: input.type === 'TEXT' ? input.textContent : null, voiceCaption: input.type === 'VOICE' ? input.voiceCaption ?? null : null, voiceAssetId: asset?.id ?? null, audioDurationMs: asset?.durationMs ?? null, presetId: input.presetId, stationeryJson: gate.preset as unknown as Prisma.InputJsonValue, deliveredAt: now, ...reviewMetadata(decision), moderationCheckedAt: decision === 'APPROVED' ? now : null,
      }, select: { id: true } });
      if (asset) await tx.voiceAsset.update({ where: { id: asset.id }, data: { status: 'ATTACHED' } });
      const saved = await tx.deliveryReceipt.create({ data: { id, ownerId: owner.id, recipientId: input.recipientId, outcome: 'DELIVERED', letterId: letter.id, createdAt: now }, select: receiptSelect });
      await this.events?.append(tx,[{ownerId:owner.id,kind:'LETTERBOX_CHANGED',peerId:input.recipientId,itemId:letter.id},{id:letter.id+':delivered',ownerId:input.recipientId,kind:'LETTER_RECEIVED',peerId:owner.id,itemId:letter.id}]);
      await tx.friendNotification.create({ data: { id: `${letter.id}:delivered`, userId: input.recipientId, letterId: letter.id, kind: 'LETTER_DELIVERED' } });
      return saved;
    });
    this.events?.notify([owner.id,input.recipientId]); return receipt(result, input.requestId);
  }
  async cancel(subject: string, requestId: string, recipientId: string): Promise<DeliveryReceipt> {
    const owner = await this.owner(subject); const id = operationId(owner.id, requestId);
    const result = await this.transaction(async tx => {
      const existing = await tx.deliveryReceipt.findUnique({ where: { id }, select: receiptSelect }); if (existing) return existing;
      await this.voice.retire(tx, owner.id, requestId);
      return tx.deliveryReceipt.create({ data: { id, ownerId: owner.id, recipientId, outcome: 'REJECTED', reason: 'CANCELLED' }, select: receiptSelect });
    });
    return receipt(result, requestId);
  }
  async list(subject: string, box: LetterBox, cursor?: string): Promise<LetterBoxPage> {
    const owner = await this.owner(subject); const boundary = letterBoundary(cursor);
    const rows = await this.prisma.letter.findMany({ where: { AND: [privateLetters(owner.id), boundary, box === 'received' ? { recipientId: owner.id } : { senderId: owner.id }] },
      select: letterSelect, orderBy: [{ deliveredAt: 'desc' }, { id: 'desc' }], take: 25 });
    const page = rows.slice(0, 24);
    return { letters: page.map(row => envelope(row, owner.id)), nextCursor: rows.length > 24 ? letterCursor(page[page.length - 1]!) : null };
  }
  async summary(subject: string): Promise<LetterBoxSummary> {
    const owner = await this.owner(subject); const visible = privateLetters(owner.id);
    const [unread, received, sent] = await Promise.all([
      this.prisma.letter.count({ where: { AND: [visible, { recipientId: owner.id, readAt: null }] } }),
      this.prisma.letter.count({ where: { AND: [visible, { recipientId: owner.id }] } }),
      this.prisma.letter.count({ where: { AND: [visible, { senderId: owner.id }] } }),
    ]);
    return { unread, received, sent };
  }
  async open(subject: string, id: string): Promise<OpenedFriendLetter> {
    const owner = await this.owner(subject);
    const visible=await this.prisma.letter.findFirst({where:{AND:[privateLetters(owner.id),{id}]},select:{type:true,voiceAsset:true}});
    if(!visible)throw new NotFoundException({code:'LETTER_UNAVAILABLE',message:'This letter is no longer available.'});
    // Supabase signs over HTTP. Keep that request outside the database
    // transaction, then recheck account and friendship before returning it.
    const grant=visible.type==='VOICE'&&visible.voiceAsset?await this.voice.storage.playback(visible.voiceAsset.storageKey):null;
    const result=await this.transaction(async tx => {
      await activeAccount(tx,owner.id);
      const row = await tx.letter.findFirst({ where: { AND: [privateLetters(owner.id), { id }] }, select: { ...letterSelect, textContent: true, voiceAsset: true, voiceCaption: true } });
      if (!row) throw new NotFoundException({ code: 'LETTER_UNAVAILABLE', message: 'This letter is no longer available.' });
      if(grant&&row.voiceAsset?.id!==visible.voiceAsset?.id)throw new NotFoundException();
      if (row.recipientId === owner.id && !row.readAt) { row.readAt = new Date(); await tx.letter.update({ where: { id }, data: { readAt: row.readAt } });await this.events?.append(tx,[{ownerId:owner.id,kind:'LETTERBOX_CHANGED',itemId:id}]); }
      return { ...envelope(row, owner.id), textContent: row.type === 'TEXT' ? row.textContent : null, audio: grant && row.voiceAsset ? { url: grant.url, expiresAt: grant.expiresAt.toISOString(), durationMs: row.voiceAsset.durationMs, mimeType: row.voiceAsset.mimeType as VoiceMime, caption: row.voiceCaption } : null };
    });this.events?.notify([owner.id]);return result;
  }
  async remove(subject: string, id: string) {
    const owner = await this.owner(subject);
    const result=await this.transaction(async tx => {
      await activeAccount(tx,owner.id);
      const row = await tx.letter.findFirst({ where: {id,destinationType:'FRIEND',OR:[{senderId:owner.id},{recipientId:owner.id}]}, select: { id: true, voiceAssetId: true,senderId:true,recipientId:true,senderDeletedAt:true,recipientDeletedAt:true } });
      if (!row) throw new NotFoundException({ code: 'LETTER_UNAVAILABLE', message: 'This letter is no longer available.' });
      const sender=row.senderId===owner.id;if(sender?row.senderDeletedAt:row.recipientDeletedAt)return {deleted:true};
      const both=Boolean(sender?row.recipientDeletedAt:row.senderDeletedAt);const now=new Date();
      await tx.letter.update({where:{id},data:{...(sender?{senderDeletedAt:now}:{recipientDeletedAt:now}),...(both?{status:'HARD_DELETED',textContent:null,voiceCaption:null,stationeryJson:Prisma.DbNull,audioUrl:null,audioDurationMs:null,voiceAssetId:null,moderationPassed:null,softDeletedAt:now,hardDeleteAfter:now}:{})}});
      if(both&&row.voiceAssetId)await tx.voiceAsset.update({where:{id:row.voiceAssetId},data:{status:'DELETED',sha256:null,purgeAfter:now}});
      await tx.friendNotification.updateMany({ where: { letterId: id,userId:owner.id, completedAt: null }, data: { completedAt: now } });
      await this.events?.append(tx,[{ownerId:owner.id,kind:'LETTER_REMOVED',itemId:id}]);
      return { deleted: true };
    }); this.events?.notify([owner.id]);return result;
  }
}
