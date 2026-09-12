import { ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { DeliveryReceipt, DeliveryRejection, FriendLetterRequest, LetterBox, LetterBoxPage, LetterBoxSummary, OpenedFriendLetter } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { serializePreset } from '../presets/preset';
import { LetterModerationService } from './letter-moderation.service';
import { correspondent, envelope, letterBoundary, letterCursor, letterSelect, privateLetters } from './private-letter-contract';

const receiptSelect = { id: true, recipientId: true, outcome: true, reason: true, letterId: true, createdAt: true } as const;
type ReceiptRow = Prisma.DeliveryReceiptGetPayload<{ select: typeof receiptSelect }>;
const operationId = (ownerId: string, requestId: string) => `delivery_${createHash('sha256').update(`${ownerId}\0${requestId.toLowerCase()}`).digest('hex')}`;
const reasons: DeliveryRejection[] = ['FRIEND_UNAVAILABLE', 'PRESET_UNAVAILABLE', 'CONTENT_NOT_ALLOWED', 'DELIVERY_LIMIT', 'CANCELLED'];
function receipt(row: ReceiptRow, requestId: string): DeliveryReceipt {
  if (row.outcome === 'DELIVERED' ? row.reason !== null || !row.letterId : row.letterId !== null || !reasons.includes(row.reason as DeliveryRejection)) throw new ServiceUnavailableException('The delivery could not be confirmed.');
  return { requestId: requestId.toLowerCase(), receiptId: row.id, recipientId: row.recipientId, outcome: row.outcome, reason: row.reason as DeliveryRejection | null, letterId: row.letterId, completedAt: row.createdAt.toISOString() };
}
@Injectable()
export class FriendLettersService {
  constructor(private readonly prisma: PrismaService, private readonly moderation: LetterModerationService) {}
  capabilities() { return { moderationAvailable: this.moderation.available }; }
  private async owner(subject: string) {
    const owner = await this.prisma.user.findUnique({ where: { authProviderId: subject }, select: { id: true, characterId: true } });
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
    const friend = input.recipientId === ownerId ? null : await tx.user.findFirst({ where: { id: input.recipientId, characterId: { not: null }, ...correspondent(ownerId) }, select: { id: true } });
    if (!friend) return { reason: 'FRIEND_UNAVAILABLE' as const, preset: null };
    const row = await tx.preset.findUnique({ where: { id: input.presetId }, select: { id: true, key: true, displayName: true, configJson: true, isActive: true } });
    const preset = row?.isActive ? serializePreset(row) : null;
    if (!preset) return { reason: 'PRESET_UNAVAILABLE' as const, preset: null };
    const recent = await tx.deliveryReceipt.count({ where: { ownerId, outcome: 'DELIVERED', createdAt: { gte: new Date(Date.now() - 86_400_000) } } });
    return { reason: recent >= 50 ? 'DELIVERY_LIMIT' as const : null, preset };
  }
  async send(subject: string, input: FriendLetterRequest): Promise<DeliveryReceipt> {
    const owner = await this.owner(subject); const id = operationId(owner.id, input.requestId);
    const preflight = await this.transaction(async tx => {
      const existing = await tx.deliveryReceipt.findUnique({ where: { id }, select: receiptSelect });
      if (existing) return existing;
      const gate = await this.gate(tx, owner.id, input);
      return gate.reason ? tx.deliveryReceipt.create({ data: { id, ownerId: owner.id, recipientId: input.recipientId, outcome: 'REJECTED', reason: gate.reason }, select: receiptSelect }) : null;
    });
    if (preflight) return receipt(preflight, input.requestId);
    // No text is persisted or made visible until the provider approves it.
    let decision: 'APPROVED' | 'REJECTED';
    try { decision = await this.moderation.check(input.textContent); }
    catch { throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'The letter check is unavailable. Your letter has not been delivered.' }); }
    if (decision !== 'APPROVED' && decision !== 'REJECTED') throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'The letter check is unavailable.' });
    const result = await this.transaction(async tx => {
      const existing = await tx.deliveryReceipt.findUnique({ where: { id }, select: receiptSelect }); if (existing) return existing;
      const gate = await this.gate(tx, owner.id, input);
      const reason = gate.reason ?? (decision === 'REJECTED' ? 'CONTENT_NOT_ALLOWED' as const : null);
      if (reason || !gate.preset) return tx.deliveryReceipt.create({ data: { id, ownerId: owner.id, recipientId: input.recipientId, outcome: 'REJECTED', reason: reason ?? 'PRESET_UNAVAILABLE' }, select: receiptSelect });
      const now = new Date();
      const letter = await tx.letter.create({ data: { id, senderId: owner.id, recipientId: input.recipientId, type: 'TEXT', destinationType: 'FRIEND', status: 'DELIVERED',
        textContent: input.textContent, presetId: input.presetId, stationeryJson: gate.preset as unknown as Prisma.InputJsonValue, deliveredAt: now, moderationPassed: true, moderationCheckedAt: now,
      }, select: { id: true } });
      const saved = await tx.deliveryReceipt.create({ data: { id, ownerId: owner.id, recipientId: input.recipientId, outcome: 'DELIVERED', letterId: letter.id, createdAt: now }, select: receiptSelect });
      await tx.friendNotification.create({ data: { id: `${letter.id}:delivered`, userId: input.recipientId, letterId: letter.id, kind: 'LETTER_DELIVERED' } });
      return saved;
    });
    return receipt(result, input.requestId);
  }
  async cancel(subject: string, requestId: string, recipientId: string): Promise<DeliveryReceipt> {
    const owner = await this.owner(subject); const id = operationId(owner.id, requestId);
    const result = await this.transaction(async tx => await tx.deliveryReceipt.findUnique({ where: { id }, select: receiptSelect }) ?? tx.deliveryReceipt.create({
      data: { id, ownerId: owner.id, recipientId, outcome: 'REJECTED', reason: 'CANCELLED' }, select: receiptSelect,
    }));
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
    return this.transaction(async tx => {
      const row = await tx.letter.findFirst({ where: { AND: [privateLetters(owner.id), { id }] }, select: { ...letterSelect, textContent: true } });
      if (!row) throw new NotFoundException({ code: 'LETTER_UNAVAILABLE', message: 'This letter is no longer available.' });
      if (row.recipientId === owner.id && !row.readAt) { row.readAt = new Date(); await tx.letter.update({ where: { id }, data: { readAt: row.readAt } }); }
      return { ...envelope(row, owner.id), textContent: row.textContent! };
    });
  }
  async remove(subject: string, id: string) {
    const owner = await this.owner(subject);
    return this.transaction(async tx => {
      const row = await tx.letter.findFirst({ where: { AND: [privateLetters(owner.id), { id }] }, select: { id: true } });
      if (!row) throw new NotFoundException({ code: 'LETTER_UNAVAILABLE', message: 'This letter is no longer available.' });
      await tx.letter.update({ where: { id }, data: { status: 'HARD_DELETED', textContent: null, stationeryJson: Prisma.DbNull, audioUrl: null, moderationPassed: null, softDeletedAt: new Date(), hardDeleteAfter: new Date() } });
      await tx.friendNotification.updateMany({ where: { letterId: id, completedAt: null }, data: { completedAt: new Date() } });
      return { deleted: true };
    });
  }
}
