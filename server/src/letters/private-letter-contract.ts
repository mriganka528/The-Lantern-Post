import { releasedContent } from './content-review';
import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { LetterEnvelope, LetterPreset } from '@lantern-post/shared-types';
import { notBlocked, person, personSelect } from '../friends/friend-contract';
import { serializePreset } from '../presets/preset';

export const letterSelect = { id: true, type: true, audioDurationMs: true, senderId: true, recipientId: true, deliveredAt: true, readAt: true, stationeryJson: true, sender: { select: personSelect }, recipient: { select: personSelect } } as const;
export type PrivateLetterRow = Prisma.LetterGetPayload<{ select: typeof letterSelect }>;
export const correspondent = (ownerId: string): Prisma.UserWhereInput => ({ ...notBlocked(ownerId), OR: [
  { friendRequestsSent: { some: { toUserId: ownerId, status: 'ACCEPTED' } } },
  { friendRequestsReceived: { some: { fromUserId: ownerId, status: 'ACCEPTED' } } },
] });
export const privateLetters = (ownerId: string): Prisma.LetterWhereInput => ({
  destinationType: 'FRIEND', status: 'DELIVERED',
  AND: [releasedContent, { OR: [{ type: 'TEXT', textContent: { not: null } }, { type: 'VOICE', voiceAsset: { status: 'ATTACHED' } }] }],
  OR: [{ recipientId: ownerId, recipientDeletedAt:null, sender: correspondent(ownerId) }, { senderId: ownerId, senderDeletedAt:null, recipient: correspondent(ownerId) }],
});
export function stationerySnapshot(value: Prisma.JsonValue): LetterPreset | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null;
  const { id, key, displayName, description, config, collection } = value;
  if (typeof id !== 'string' || typeof key !== 'string' || typeof displayName !== 'string' || typeof description !== 'string' || !config || Array.isArray(config) || typeof config !== 'object') return null;
  const preset = serializePreset({ id, key, displayName, configJson: { ...config, version: 1, order: 0, description, collection } });
  return preset ? { id: preset.id, key: preset.key, displayName: preset.displayName, description: preset.description, config: preset.config, ...(preset.collection ? { collection: preset.collection } : {}) } : null;
}
export function envelope(row: PrivateLetterRow, ownerId: string): LetterEnvelope {
  const preset = stationerySnapshot(row.stationeryJson);
  const other = row.recipientId === ownerId ? row.sender : row.recipient;
  if (!preset || !other || !row.deliveredAt) throw new ServiceUnavailableException('This letter could not be opened.');
  return { id: row.id, type: row.type, audioDurationMs: row.type === 'VOICE' ? row.audioDurationMs : null, person: person(other), direction: row.recipientId === ownerId ? 'received' : 'sent', preset, deliveredAt: row.deliveredAt.toISOString(), readAt: row.recipientId === ownerId ? row.readAt?.toISOString() ?? null : null };
}
export function letterBoundary(cursor?: string): Prisma.LetterWhereInput {
  if (!cursor) return {};
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || typeof value[1] !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value[1])) throw new Error();
    const date = new Date(value[0]); if (!Number.isFinite(date.getTime()) || date.toISOString() !== value[0]) throw new Error();
    return { OR: [{ deliveredAt: { lt: date } }, { deliveredAt: date, id: { lt: value[1] } }] };
  } catch { throw new BadRequestException('Invalid letter cursor.'); }
}
export const letterCursor = (row: PrivateLetterRow) => Buffer.from(JSON.stringify([row.deliveredAt?.toISOString(), row.id])).toString('base64url');
