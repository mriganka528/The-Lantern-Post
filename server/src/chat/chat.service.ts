import { PalaceEvents } from '../realtime/palace-events';
import { Optional } from '@nestjs/common';
import { releasedContent, reviewMetadata } from '../letters/content-review';
import type { ContentDecision } from '../letters/content-review';
import { activeAccount } from '../account/account-access';
import { ConflictException, HttpException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ChatReceipt as ReceiptRow } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import type { ChatPage, ChatReceipt, ChatRejection, ChatSendRequest, LetterReportReceipt, LetterReportRequest } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { LetterModerationService } from '../letters/letter-moderation.service';
import { moderationDecision } from '../letters/moderation-deadline';
import { person, personSelect } from '../friends/friend-contract';
import { SafetyService } from '../safety/safety.service';
import { ChatSignal } from './chat-signal';
import { correspondent } from '../letters/private-letter-contract';

const hash = (scope: string, ...values: string[]) => scope + '_' + createHash('sha256').update(values.join('\0')).digest('hex');
export const chatThreadId = (a: string, b: string) => hash('thread', ...[a, b].sort());
const messageSelect = { id: true, sequence: true, senderId: true, text: true, createdAt: true } as const;
function receipt(row: ReceiptRow, requestId: string, peerId: string): ChatReceipt {
  if (row.peerId !== peerId) throw new ConflictException({ code: 'CHAT_REQUEST_CONFLICT', message: 'This message already has a different destination.' });
  return { requestId: requestId.toLowerCase(), peerId, outcome: row.outcome, reason: row.reason as ChatRejection | null, messageId: row.messageId, sequence: row.sequence, completedAt: row.createdAt.toISOString() };
}
@Injectable()
export class ChatService {
  private polls = new Map<string, number>();
  constructor(private prisma: PrismaService, private moderation: LetterModerationService, private safety: SafetyService, private signal: ChatSignal, @Optional() private events?: PalaceEvents) {}
  capabilities() { return { textAvailable: this.moderation.available }; }
  private async owner(subject: string) { const owner = await this.prisma.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: { id: true, characterId: true } }); if (!owner?.characterId) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose your username and companion first.' }); return owner; }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 }); }
      catch (error) { if (error instanceof HttpException) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034', 'P2025'].includes(error.code) && attempt < 3) continue; throw new ServiceUnavailableException({ code: 'CHAT_UNAVAILABLE', message: 'The parlour post is resting. Your message has not been confirmed.' }); }
    }
    throw new ServiceUnavailableException();
  }
  private async gate(tx: Prisma.TransactionClient, ownerId: string, peerId: string) {
    await activeAccount(tx, ownerId);
    if (ownerId === peerId) return null;
    return tx.user.findFirst({ where: { id: peerId, characterId: { not: null }, ...correspondent(ownerId) }, select: personSelect });
  }
  private unavailable(): never { throw new NotFoundException({ code: 'CHAT_GATE_CLOSED', message: 'This friendship parlour is unavailable.' }); }
  async history(subject: string, peerId: string, before?: number, after?: number): Promise<ChatPage> {
    const owner = await this.owner(subject);return this.streamHistory(owner.id,peerId,before,after);
  }
  async streamHistory(ownerId:string,peerId:string,before?:number,after?:number,pageSize=50):Promise<ChatPage> {
    const threadId=chatThreadId(ownerId,peerId);
    return this.transaction(async tx => {
      const peer = await this.gate(tx, ownerId, peerId); if (!peer) this.unavailable();
      const take = Math.max(1, Math.min(50, pageSize));
      const rows = await tx.chatMessage.findMany({ where: { threadId, AND: [releasedContent], erasedAt: null, ...(before !== undefined ? { sequence: { lt: before } } : after !== undefined ? { sequence: { gt: after } } : {}) }, select: messageSelect, orderBy: { sequence: after !== undefined ? 'asc' : 'desc' }, take: take + 1 });
      const page = rows.slice(0, take); if (after === undefined) page.reverse();
      return { peer: person(peer), messages: page.map(row => ({ id: row.id, sequence: row.sequence, side: row.senderId === ownerId ? 'mine' : 'theirs', text: row.text, createdAt: row.createdAt.toISOString() })), cursor: page[page.length - 1]?.sequence ?? after ?? 0, before: after === undefined && rows.length > take ? page[0]!.sequence : null, capabilities: this.capabilities() };
    });
  }
  async poll(subject: string, peerId: string, after: number, abort?: AbortSignal, durationMs = 10000): Promise<ChatPage> {
    const owner = await this.owner(subject); const count = this.polls.get(owner.id) ?? 0;
    if (count >= 4) throw new HttpException({ code: 'REQUEST_LIMIT', message: 'Too many open parlours. Close another window and try again.' }, 429);
    this.polls.set(owner.id, count + 1); const until = Date.now() + durationMs; const threadId = chatThreadId(owner.id, peerId);
    try {
      while (true) {
        if (abort?.aborted) throw new HttpException('Request closed.', 499);
        const page = await this.history(subject, peerId, undefined, after);
        if (page.messages.length || Date.now() >= until) return page;
        await this.signal.wait(threadId, abort, Math.min(750, Math.max(1, until - Date.now())));
      }
    } finally { const active = (this.polls.get(owner.id) ?? 1) - 1; if (active) this.polls.set(owner.id, active); else this.polls.delete(owner.id); }
  }
  async status(subject: string, peerId: string, requestId: string) { const owner = await this.owner(subject); const row = await this.prisma.chatReceipt.findUnique({ where: { id: hash('chat', owner.id, requestId.toLowerCase()) } }); return row ? receipt(row, requestId, peerId) : null; }
  async cancel(subject: string, peerId: string, requestId: string): Promise<ChatReceipt> {
    const owner = await this.owner(subject); const id = hash('chat', owner.id, requestId.toLowerCase());
    const row = await this.transaction(async tx => (await tx.chatReceipt.findUnique({ where: { id } })) ?? tx.chatReceipt.create({ data: { id, ownerId: owner.id, peerId, outcome: 'REJECTED', reason: 'CANCELLED' } }));
    return receipt(row, requestId, peerId);
  }
  async send(subject: string, peerId: string, input: ChatSendRequest): Promise<ChatReceipt> {
    const owner = await this.owner(subject); const id = hash('chat', owner.id, input.requestId.toLowerCase());
    const existing = this.moderation.disabled?null:await this.prisma.chatReceipt.findUnique({ where: { id } }); if (existing) return receipt(existing, input.requestId, peerId);
    const reject = (tx: Prisma.TransactionClient, reason: ChatRejection) => tx.chatReceipt.create({ data: { id, ownerId: owner.id, peerId, outcome: 'REJECTED', reason } });
    const before = this.moderation.disabled ? null : await this.transaction(async tx => {
      const old = await tx.chatReceipt.findUnique({ where: { id } }); if (old) return old;
      if (!await this.gate(tx, owner.id, peerId)) return reject(tx, 'FRIEND_UNAVAILABLE');
      return null;
    }); if (before) return receipt(before, input.requestId, peerId);
    if (!this.moderation.available) throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'Live chat is resting. Your words have not been sent.' });
    let approved: ContentDecision;
    try { approved = await moderationDecision(signal => this.moderation.check(input.text, signal)); }
    catch { throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE', message: 'The message check is resting. Your words have not been sent.' }); }
    const threadId = chatThreadId(owner.id, peerId);
    const outcome = await this.transaction(async tx => {
      const old = await tx.chatReceipt.findUnique({ where: { id } }); if (old) return old;
      if (!await this.gate(tx, owner.id, peerId)) return reject(tx, 'FRIEND_UNAVAILABLE');
      if (approved === 'REJECTED') return reject(tx, 'CONTENT_NOT_ALLOWED');
      const day = new Date(); day.setUTCHours(0, 0, 0, 0);
      if (await tx.chatReceipt.count({ where: { ownerId: owner.id, outcome: 'DELIVERED', createdAt: { gte: day } } }) >= 500) return reject(tx, 'DAILY_LIMIT');
      // Updating this row serializes each thread's numbering with its commit.
      // A later commit can never slip behind the recipient's stream cursor.
      const [firstUserId,secondUserId]=[owner.id,peerId].sort() as [string,string];
      const next=await tx.chatThread.upsert({where:{id:threadId},create:{id:threadId,firstUserId,secondUserId,nextSequence:1},update:{nextSequence:{increment:1}}});
      const message = await tx.chatMessage.create({ data: { id: 'chatmsg_' + randomUUID(), threadId, sequence: next.nextSequence, senderId: owner.id, text: input.text, ...reviewMetadata(approved) } });
      const eventId=message.id+':delivered';
      await this.events?.append(tx,[{ownerId:owner.id,kind:'CHAT_CHANGED',peerId,itemId:message.id},{id:eventId,ownerId:peerId,kind:'CHAT_RECEIVED',peerId:owner.id,itemId:message.id}]);
      await tx.friendNotification.create({data:{id:eventId,userId:peerId,chatMessageId:message.id,kind:'CHAT_MESSAGE'}});
      return tx.chatReceipt.create({ data: { id, ownerId: owner.id, peerId, outcome: 'DELIVERED', messageId: message.id, sequence: message.sequence } });
    });
    this.signal.notify(threadId); this.events?.notify([owner.id,peerId]); return receipt(outcome, input.requestId, peerId);
  }
  async report(subject: string, messageId: string, input: LetterReportRequest): Promise<LetterReportReceipt> {
    const owner = await this.owner(subject);
    const result=await this.transaction(async tx => {
      await activeAccount(tx, owner.id);
      const message = await tx.chatMessage.findFirst({ where: { id: messageId, AND: [releasedContent], erasedAt: null, senderId: { not: owner.id }, thread: { OR: [{ firstUserId: owner.id }, { secondUserId: owner.id }] } }, select: { id: true, senderId: true } });
      if (!message) this.unavailable();
      const id = hash('chatreport', owner.id, messageId);
      const report = await tx.chatReport.findUnique({ where: { id } }) ?? await tx.chatReport.create({ data: { id, messageId, reporterId: owner.id, reason: input.reason, detail: input.detail?.trim() || null } });
      if (input.blockSender) await this.safety.blockPair(tx, owner.id, message.senderId);
      return { id: report.id, status: report.status, createdAt: report.createdAt.toISOString(), blocked: input.blockSender };
    });this.events?.notifyAll();return result;
  }
}
