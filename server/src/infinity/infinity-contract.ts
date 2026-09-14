import { releasedContent } from '../letters/content-review';
import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { WorldBounds, WorldStar } from '@lantern-post/shared-types';
import { notBlocked } from '../friends/friend-contract';
export const publicLetters = (ownerId: string): Prisma.LetterWhereInput => ({ destinationType: 'INFINITY', status: 'DELIVERED', AND: [releasedContent], sender: notBlocked(ownerId),
  OR: [{ type: 'TEXT', textContent: { not: null } }, { type: 'VOICE', voiceAsset: { status: 'ATTACHED', destinationType: 'INFINITY' } }],
});
export const starSelect = { id: true, type: true, posX: true, posY: true, deliveredAt: true } as const;
type StarRow = Prisma.LetterGetPayload<{ select: typeof starSelect }>;
export const star = (row: StarRow): WorldStar => ({ id: row.id, type: row.type, x: row.posX!, y: row.posY! });
const boxArray = (box: WorldBounds | null) => box ? [box.minX, box.minY, box.maxX, box.maxY] : null;
export function worldPagination(box: WorldBounds | null, cursor?: string) {
  if (box && (!(box.minX < box.maxX && box.minY < box.maxY) || box.minX < 0 || box.minY < 0 || box.maxX > 1600 || box.maxY > 1000)) throw new BadRequestException('Invalid sky view.');
  let cutoff = new Date(); let boundary: Prisma.LetterWhereInput = {};
  if (cursor) try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (!Array.isArray(value) || value.length !== 4 || JSON.stringify(value[0]) !== JSON.stringify(boxArray(box)) || typeof value[1] !== 'string' || typeof value[2] !== 'string' || typeof value[3] !== 'string' || !/^star_[a-f0-9-]{36}$/.test(value[3])) throw new Error();
    cutoff = new Date(value[1]); const date = new Date(value[2]);
    if (!Number.isFinite(cutoff.getTime()) || !Number.isFinite(date.getTime()) || cutoff.toISOString() !== value[1] || date.toISOString() !== value[2] || date > cutoff || cutoff.getTime() > Date.now() + 1000) throw new Error();
    boundary = { OR: [{ deliveredAt: { lt: date } }, { deliveredAt: date, id: { lt: value[3] } }] };
  } catch { throw new BadRequestException('Invalid sky cursor.'); }
  return { where: { AND: [boundary, { deliveredAt: { lte: cutoff } }, ...(box ? [{ posX: { gte: box.minX, lte: box.maxX }, posY: { gte: box.minY, lte: box.maxY } }] : [])] },
    cursor: (row: StarRow) => Buffer.from(JSON.stringify([boxArray(box), cutoff.toISOString(), row.deliveredAt!.toISOString(), row.id])).toString('base64url'),
  };
}
