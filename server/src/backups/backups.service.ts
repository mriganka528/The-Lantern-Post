import { releasedContent } from '../letters/content-review';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { activeAccount } from '../account/account-access';
import { notBlocked } from '../friends/friend-contract';
import { backupOwnerKey } from './drive.service';
import { chatThreadId } from '../chat/chat.service';
import { chatVisibleTo } from '../chat/chat-visibility';

@Injectable()
export class BackupsService {
  constructor(private prisma: PrismaService) {}
  private async owner(subject: string) {
    const owner = await this.prisma.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: { id: true } });
    if (!owner) throw new NotFoundException(); return owner.id;
  }
  async manifest(subject: string) {
    const ownerId = await this.owner(subject);
    return this.prisma.$transaction(async tx => {
      await activeAccount(tx, ownerId);
      const requests = await tx.friendRequest.findMany({ where: { status: 'ACCEPTED', OR: [{ fromUserId: ownerId }, { toUserId: ownerId }], fromUser: notBlocked(ownerId), toUser: notBlocked(ownerId) }, take: 501 });
      if (requests.length > 500) throw new BadRequestException('Too many conversations for one backup.');
      const conversations = [];
      for (const r of requests) {
        const peerId = r.fromUserId === ownerId ? r.toUserId : r.fromUserId;
        const peer = await tx.user.findFirst({ where: { id: peerId, ...notBlocked(ownerId) }, select: { username: true } });
        const thread = await tx.chatThread.findUnique({ where: { id: chatThreadId(ownerId, peerId) } });
        if (peer && thread) conversations.push({ peerId, username: peer.username, through: thread.nextSequence });
      }
      return { ownerKey: backupOwnerKey(ownerId), conversations };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
  async page(subject: string, peerId: string, through: number, before: number) {
    const ownerId = await this.owner(subject);
    return this.prisma.$transaction(async tx => {
      await activeAccount(tx, ownerId);
      const peer = await tx.user.findFirst({ where: { id: peerId, ...notBlocked(ownerId) } });
      const friend = await tx.friendRequest.findFirst({ where: { status: 'ACCEPTED', OR: [{ fromUserId: ownerId, toUserId: peerId }, { toUserId: ownerId, fromUserId: peerId }] } });
      if (!peer || !friend) throw new NotFoundException('This conversation is closed.');
      const rows = await tx.chatMessage.findMany({ where: { threadId: chatThreadId(ownerId, peerId), erasedAt: null, AND: [releasedContent, chatVisibleTo(ownerId)], sequence: { lte: through, lt: before } }, orderBy: { sequence: 'desc' }, take: 201 });
      return { messages: rows.slice(0,200).map(row => ({ sequence: row.sequence, side: row.senderId === ownerId ? 'mine' : 'theirs', text: row.text, createdAt: row.createdAt.toISOString() })), before: rows.length > 200 ? rows[199]!.sequence : null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
