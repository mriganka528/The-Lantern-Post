import { ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { BurnLetterRequest, BurnReceipt } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { serializePreset } from '../presets/preset';
import { activeAccount } from '../account/account-access';

const receiptSelect = { id: true, outcome: true, reason: true, createdAt: true } as const;
type ReceiptRow = Prisma.BurnReceiptGetPayload<{ select: typeof receiptSelect }>;

function operationId(ownerId: string, requestId: string) {
  // Not a content hash. UUIDs from different accounts cannot collide or probe
  // one another's operations, and request IDs reveal no provider identity.
  return `burn_${createHash('sha256').update(`${ownerId}\0${requestId.toLowerCase()}`).digest('hex')}`;
}
function serializeReceipt(row: ReceiptRow, requestId: string): BurnReceipt {
  if ((row.outcome === 'BURNED' && row.reason !== null) || (row.outcome === 'REJECTED' && row.reason !== 'PRESET_UNAVAILABLE')) {
    throw new ServiceUnavailableException('The release could not be confirmed.');
  }
  return { requestId: requestId.toLowerCase(), receiptId: row.id, outcome: row.outcome, reason: row.reason as BurnReceipt['reason'], completedAt: row.createdAt.toISOString() };
}

@Injectable()
export class LettersService {
  constructor(private readonly prisma: PrismaService) {}

  private async owner(authProviderId: string) {
    const owner = await this.prisma.user.findUnique({ where: { authProviderId, accountState: 'ACTIVE' }, select: { id: true, characterId: true } });
    if (!owner) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose a username first.' });
    return owner;
  }

  async receipt(authProviderId: string, requestId: string): Promise<BurnReceipt | null> {
    const owner = await this.owner(authProviderId);
    const row = await this.prisma.burnReceipt.findUnique({ where: { id: operationId(owner.id, requestId) }, select: receiptSelect });
    return row ? serializeReceipt(row, requestId) : null;
  }

  async burn(authProviderId: string, input: BurnLetterRequest): Promise<BurnReceipt> {
    const owner = await this.owner(authProviderId);
    const id = operationId(owner.id, input.requestId);
    const existing = await this.prisma.burnReceipt.findUnique({ where: { id }, select: receiptSelect });
    if (existing) return serializeReceipt(existing, input.requestId);
    if (!owner.characterId) throw new ConflictException({ code: 'CHARACTER_REQUIRED', message: 'Choose a companion first.' });

    try {
      const receipt = await this.prisma.$transaction(async tx => {
        await activeAccount(tx, owner.id);
        const preset = await tx.preset.findUnique({ where: { id: input.presetId }, select: { id: true, key: true, displayName: true, configJson: true, isActive: true } });
        if (!preset?.isActive || !serializePreset(preset)) {
          return tx.burnReceipt.create({ data: { id, ownerId: owner.id, outcome: 'REJECTED', reason: 'PRESET_UNAVAILABLE' }, select: receiptSelect });
        }
        const now = new Date();
        // Phase 4 has no audience and needs no retained content. Write a
        // content-free HARD_DELETED audit stub; input.textContent is never used
        // in a database call, log, receipt, or moderation queue.
        const letter = await tx.letter.create({ data: {
          id, senderId: owner.id, type: input.type, destinationType: 'BURNING', presetId: preset.id,
          status: 'HARD_DELETED', textContent: null, audioUrl: null, audioDurationMs: null,
          recipientId: null, isSigned: false, posX: null, posY: null,
          deliveredAt: now, softDeletedAt: now, hardDeleteAfter: now,
        }, select: { id: true } });
        return tx.burnReceipt.create({ data: { id, ownerId: owner.id, outcome: 'BURNED', letterId: letter.id, createdAt: now }, select: receiptSelect });
      }, { timeout: 10_000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return serializeReceipt(receipt, input.requestId);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        // The winning transaction decides both the receipt and the audit row.
        // The losing transaction rolls back, even if it chose another outcome.
        const winner = await this.prisma.burnReceipt.findUnique({ where: { id }, select: receiptSelect });
        if (winner) return serializeReceipt(winner, input.requestId);
      }
      throw new ServiceUnavailableException({ code: 'BURN_UNCONFIRMED', message: 'The release could not be confirmed. Retry the same request.' });
    }
  }
}
