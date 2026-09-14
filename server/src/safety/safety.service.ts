import { PalaceEvents } from '../realtime/palace-events';
import { Optional } from '@nestjs/common';
import { releasedContent } from '../letters/content-review';
import { activeAccount } from '../account/account-access';
import { ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { BlockedPalacesPage, LetterReportReceipt, LetterReportRequest } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { pageBoundary, REQUEST_COOLDOWN_MS } from '../friends/friend-contract';
const pair = (a: string, b: string) => ({ OR: [{ fromUserId: a, toUserId: b }, { fromUserId: b, toUserId: a }] });
const stableId = (scope: string, a: string, b: string) => `${scope}_${createHash('sha256').update(`${a}\0${b}`).digest('hex')}`;
@Injectable()
export class SafetyService {
  constructor(private readonly prisma: PrismaService, @Optional() private events?: PalaceEvents) {}
  private async owner(subject: string) {
    const user = await this.prisma.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: { id: true, characterId: true } });
    if (!user?.characterId) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose a username and companion first.' }); return user;
  }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }); }
      catch (error) { if (error instanceof HttpException) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034', 'P2025'].includes(error.code) && attempt < 3) continue; throw new ServiceUnavailableException({ code: 'SAFETY_UNCONFIRMED', message: 'Your choice could not be saved. Please try again.' }); }
    }
    throw new ServiceUnavailableException();
  }
  async blockPair(tx: Prisma.TransactionClient, ownerId: string, targetId: string, anonymous = false) {
    await activeAccount(tx, ownerId);
    await this.events?.append(tx,[{ownerId,kind:'GATES_CHANGED'},{ownerId:targetId,kind:'GATES_CHANGED'}]);
    if (ownerId === targetId || !await tx.user.findUnique({ where: { id: targetId }, select: { id: true } })) throw new NotFoundException({ code: 'PALACE_UNAVAILABLE', message: 'This palace is unavailable.' });
    const existing = await tx.block.findFirst({ where: { blockerId: ownerId, blockedId: targetId } });
    if (!existing) await tx.block.create({ data: { id: `block_${randomUUID()}`, blockerId: ownerId, blockedId: targetId, anonymousAlias: anonymous ? `closed_${randomUUID()}` : null } });
    else if (anonymous && !existing.anonymousAlias) await tx.block.update({ where: { id: existing.id }, data: { id: `block_${randomUUID()}`, anonymousAlias: `closed_${randomUUID()}` } });
    await tx.friendRequest.updateMany({ where: pair(ownerId, targetId), data: { status: 'BLOCKED', respondedAt: new Date() } });
    await tx.voiceAsset.updateMany({ where: { status: { in: ['UPLOADING', 'READY'] }, OR: [{ ownerId, recipientId: targetId }, { ownerId: targetId, recipientId: ownerId }] }, data: { status: 'DELETED', sha256: null, purgeAfter: new Date() } });
  }
  async block(subject: string, targetId: string) { const owner = await this.owner(subject); await this.transaction(tx => this.blockPair(tx, owner.id, targetId)); this.events?.notifyAll(); return { blocked: true as const }; }
  async blockPublic(subject: string, letterId: string) {
    const owner = await this.owner(subject);
    await this.transaction(async tx => {
      const letter = await tx.letter.findFirst({ where: { id: letterId, destinationType: 'INFINITY', status: 'DELIVERED', AND: [releasedContent], senderId: { not: owner.id } }, select: { senderId: true, isSigned: true } });
      if (!letter) throw new NotFoundException({ code: 'LETTER_UNAVAILABLE', message: 'This light is unavailable.' });
      await this.blockPair(tx, owner.id, letter.senderId, !letter.isSigned);
    }); this.events?.notifyAll(); return { blocked: true as const };
  }
  async unblock(subject: string, targetId: string) {
    const owner = await this.owner(subject);
    await this.transaction(async tx => {
      const mine = await tx.block.findFirst({ where: { blockerId: owner.id, OR: [{ blockedId: targetId }, { anonymousAlias: targetId }] } });
      if (!mine) return;
      await this.events?.append(tx,[{ownerId:owner.id,kind:'GATES_CHANGED'},{ownerId:mine.blockedId,kind:'GATES_CHANGED'}]);
      await tx.block.deleteMany({ where: { id: mine.id, blockerId: owner.id } });
      const reverse = await tx.block.findFirst({ where: { blockerId: mine.blockedId, blockedId: owner.id } });
      if (!reverse) await tx.friendRequest.updateMany({ where: { ...pair(owner.id, mine.blockedId), status: 'BLOCKED' }, data: { status: 'DECLINED', respondedAt: new Date(Date.now() - REQUEST_COOLDOWN_MS - 1000) } });
    });
    this.events?.notifyAll();return { unblocked: true as const };
  }
  async blocked(subject: string, cursor?: string): Promise<BlockedPalacesPage> {
    const owner = await this.owner(subject); const boundary = pageBoundary(cursor) as Prisma.BlockWhereInput;
    const rows = await this.prisma.block.findMany({ where: { AND: [{ blockerId: owner.id }, boundary] }, select: { id: true, anonymousAlias: true, createdAt: true, blocked: { select: { id: true, username: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 25 });
    const page = rows.slice(0, 24); const last = page[page.length - 1];
    return { items: page.map(row => ({ id: row.anonymousAlias ?? row.blocked.id, username: row.anonymousAlias ? null : row.blocked.username, blockedAt: row.createdAt.toISOString() })), nextCursor: rows.length > 24 && last ? Buffer.from(JSON.stringify([last.createdAt.toISOString(), last.id])).toString('base64url') : null };
  }
  async report(subject: string, letterId: string, input: LetterReportRequest): Promise<LetterReportReceipt> {
    const owner = await this.owner(subject);
    const result=await this.transaction(async tx => {
      await activeAccount(tx,owner.id);
      const existing = await tx.report.findFirst({ where: { letterId, reporterId: owner.id } });
      // A recipient may report their delivered letter even after closing a gate.
      // No text/audio is returned or copied into the report; strangers and
      // senders cannot use this endpoint to inspect or report someone else's mail.
      const letter = await tx.letter.findFirst({ where: { id: letterId, senderId: { not: owner.id }, status: 'DELIVERED', AND: [releasedContent], OR: [{ destinationType: 'FRIEND', recipientId: owner.id }, { destinationType: 'INFINITY' }] }, select: { id: true, senderId: true, destinationType: true, isSigned: true } });
      if (!letter && !existing) throw new NotFoundException({ code: 'LETTER_UNAVAILABLE', message: 'This received letter is unavailable.' });
      const report = existing ?? await tx.report.create({ data: { id: stableId('report', owner.id, letterId), letterId, reporterId: owner.id, reportedUserId: letter!.senderId, reason: input.reason, detail: input.detail?.trim() || null } });
      if (input.blockSender) {
        const context = letter ?? await tx.letter.findUnique({ where: { id: letterId }, select: { destinationType: true, isSigned: true } });
        await this.blockPair(tx, owner.id, report.reportedUserId, !context || (context.destinationType === 'INFINITY' && !context.isSigned));
      }
      return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString(), blocked: input.blockSender };
    }); this.events?.notifyAll();return result;
  }
}
