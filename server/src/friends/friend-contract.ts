import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { FriendConnection, FriendPerson, FriendRelationship } from '@lantern-post/shared-types';
import { serializeCharacter } from '../characters/catalog';

export const personSelect = { id: true, username: true, character: { select: { id: true, key: true, displayName: true, assetUrl: true } } } as const;
export const connectionSelect = { id: true, fromUserId: true, toUserId: true, status: true, createdAt: true, respondedAt: true, fromUser: { select: personSelect }, toUser: { select: personSelect } } as const;
export type ConnectionRow = Prisma.FriendRequestGetPayload<{ select: typeof connectionSelect }>;
export const REQUEST_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export function person(row: Prisma.UserGetPayload<{ select: typeof personSelect }>): FriendPerson {
  return { id: row.id, username: row.username, character: row.character ? serializeCharacter(row.character) : null };
}
export function connection(row: ConnectionRow, ownerId: string): FriendConnection {
  if (row.status === 'BLOCKED') throw new BadRequestException('This invitation is unavailable.');
  return { id: row.id, person: person(row.fromUserId === ownerId ? row.toUser : row.fromUser), status: row.status,
    direction: row.toUserId === ownerId ? 'incoming' : 'outgoing', createdAt: row.createdAt.toISOString(), respondedAt: row.respondedAt?.toISOString() ?? null };
}
export function relationship(row: Pick<ConnectionRow, 'status' | 'fromUserId' | 'respondedAt'> | undefined, ownerId: string, now = Date.now()): FriendRelationship {
  if (!row) return 'NONE';
  if (row.status === 'ACCEPTED') return 'FRIENDS';
  if (row.status === 'PENDING') return row.fromUserId === ownerId ? 'OUTGOING' : 'INCOMING';
  if (row.status === 'DECLINED' && row.respondedAt && now - row.respondedAt.getTime() >= REQUEST_COOLDOWN_MS) return 'NONE';
  return 'UNAVAILABLE';
}
export const notBlocked = (ownerId: string): Prisma.UserWhereInput => ({
  blockedUsers: { none: { blockedId: ownerId } }, blockedByUsers: { none: { blockerId: ownerId } },
});
export function visibleConnections(ownerId: string): Prisma.FriendRequestWhereInput {
  return { OR: [{ fromUserId: ownerId }, { toUserId: ownerId }], fromUser: notBlocked(ownerId), toUser: notBlocked(ownerId), status: { not: 'BLOCKED' } };
}
export function pageBoundary(cursor?: string): Prisma.FriendRequestWhereInput {
  if (!cursor) return {};
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!Array.isArray(decoded) || decoded.length !== 2 || typeof decoded[0] !== 'string' || typeof decoded[1] !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(decoded[1])) throw new Error();
    const at = new Date(decoded[0]); if (!Number.isFinite(at.getTime()) || at.toISOString() !== decoded[0]) throw new Error();
    return { OR: [{ createdAt: { lt: at } }, { createdAt: at, id: { lt: decoded[1] } }] };
  } catch { throw new BadRequestException('Invalid list cursor.'); }
}
export const nextCursor = (row: Pick<ConnectionRow, 'createdAt' | 'id'>) => Buffer.from(JSON.stringify([row.createdAt.toISOString(), row.id])).toString('base64url');
