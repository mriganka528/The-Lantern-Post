import { ConflictException, Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PushRegistration } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import type { Environment } from '../config/environment';
import { notBlocked } from '../friends/friend-contract';
import { privateLetters } from '../letters/private-letter-contract';
import { activeAccount } from '../account/account-access';
import { Prisma } from '@prisma/client';
import { PalaceEvents } from '../realtime/palace-events';
import { correspondent } from '../letters/private-letter-contract';
import { releasedContent } from '../letters/content-review';

type ExpoTicket = { status?: string; id?: string; details?: { error?: string } };
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  private queued=false;private stopWake:(()=>void)|undefined;
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService<Environment, true>,private events:PalaceEvents) {}
  get enabled() { return this.config.get('EXPO_PUSH_ENABLED'); }
  async inbox(subject: string) { const owner = await this.owner(subject); return this.events.inbox(owner.id); }
  onModuleInit() {
    if (this.enabled) { this.stopWake=this.events.onCommit(()=>this.wake());this.timer = setInterval(() => { void this.dispatch().catch(() => {}); }, 3000); this.timer.unref(); }
  }
  private wake(){if(!this.enabled)return;if(this.running){this.queued=true;return;}queueMicrotask(()=>{void this.dispatch().catch(()=>{});});}
  onModuleDestroy() { if (this.timer) clearInterval(this.timer);this.stopWake?.(); }
  private async owner(subject: string) {
    const owner = await this.prisma.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: { id: true } });
    if (!owner) throw new ConflictException({ code: 'PROFILE_REQUIRED', message: 'Choose a username first.' });
    return owner;
  }
  async register(subject: string, input: PushRegistration) {
    const owner = await this.owner(subject);
    if (!this.enabled) throw new ConflictException({ code: 'PUSH_UNAVAILABLE', message: 'Device notifications are unavailable right now.' });
    // Expo's opaque installation token moves to the currently signed-in owner.
    // A late unregister is scoped to the old owner and cannot remove this row.
    await this.prisma.$transaction(async tx => { await activeAccount(tx,owner.id); await tx.pushToken.upsert({ where: { token: input.token }, create: { userId: owner.id, ...input }, update: { userId: owner.id, platform: input.platform, createdAt: new Date() } }); },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    const excess = await this.prisma.pushToken.findMany({ where: { userId: owner.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: 5, select: { id: true } });
    if (excess.length) await this.prisma.pushToken.deleteMany({ where: { userId: owner.id, id: { in: excess.map(t => t.id) }, token: { not: input.token } } });
    return { enabled: true };
  }
  async unregister(subject: string, token: string) {
    const owner = await this.owner(subject);
    await this.prisma.pushToken.deleteMany({ where: { userId: owner.id, token } });
    return { enabled: false };
  }
  async dispatch() {
    if (!this.enabled || this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const jobs = await this.prisma.friendNotification.findMany({ where: { completedAt: null, availableAt: { lte: now }, OR: [{ claimedUntil: null }, { claimedUntil: { lt: now } }] }, orderBy: { createdAt: 'asc' }, take: 10 });
      for (const job of jobs) {
        const claim = new Date(Date.now() + 120_000);
        const claimed = await this.prisma.friendNotification.updateMany({ where: { id: job.id, completedAt: null, OR: [{ claimedUntil: null }, { claimedUntil: { lt: new Date() } }] }, data: { claimedUntil: claim, attempts: { increment: 1 } } });
        if (!claimed.count) continue;
        const finish = () => this.prisma.friendNotification.updateMany({ where: { id: job.id, claimedUntil: claim }, data: { completedAt: new Date(), claimedUntil: null } });
        try {
          // Skip stale/declined invitations and relationships blocked since enqueue.
          const letterDelivery = job.kind === 'LETTER_DELIVERED';
          const chatDelivery=job.kind==='CHAT_MESSAGE';
          const chat=chatDelivery&&job.chatMessageId?await this.prisma.chatMessage.findFirst({where:{id:job.chatMessageId,erasedAt:null,recipientDeletedAt:null,AND:[releasedContent],sender:correspondent(job.userId),thread:{OR:[{firstUserId:job.userId},{secondUserId:job.userId}]}},select:{id:true,senderId:true}}):null;
          const valid = chatDelivery?chat:letterDelivery ? job.letterId && await this.prisma.letter.findFirst({ where: { AND: [privateLetters(job.userId), { id: job.letterId, recipientId: job.userId, readAt: null }] }, select: { id: true } }) :
            job.requestId && await this.prisma.friendRequest.findFirst({ where: { id: job.requestId, status: job.kind === 'FRIEND_REQUEST' ? 'PENDING' : 'ACCEPTED',
              fromUser: notBlocked(job.userId), toUser: notBlocked(job.userId),
              ...(job.kind === 'FRIEND_REQUEST' ? { toUserId: job.userId } : { fromUserId: job.userId }) }, select: { id: true } });
          if (!valid || Date.now() - job.createdAt.getTime() > 86_400_000 || job.attempts >= 8) { await finish(); continue; }
          const tokens = await this.prisma.pushToken.findMany({ where: { userId: job.userId }, select: { id: true, token: true }, take: 5, orderBy: { createdAt: 'desc' } });
          if (!tokens.length) { await finish(); continue; }
          const access = this.config.get('EXPO_ACCESS_TOKEN');
          const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
            headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}) },
            body: JSON.stringify(tokens.map(t => ({ to: t.token, title: 'Lantern Post', body: chatDelivery?'A new message is waiting in your friendship parlour.':letterDelivery ? 'A sealed letter is waiting at your palace gate.' : job.kind === 'FRIEND_REQUEST' ? 'A new invitation is waiting at your palace gate.' : 'A new gate has opened in your circle of friends.',
              sound: 'default', channelId: 'palace-invitations', ttl: 3600, data: { type: job.kind, eventId: job.id, ownerId: job.userId, ...(chatDelivery?{messageId:chat!.id,peerId:chat!.senderId,screen:'chat'}:letterDelivery ? { letterId: job.letterId, screen: 'inbox' } : { requestId: job.requestId, screen: 'friends' }) } }))),
          });
          if (!response.ok) throw new Error('Push provider unavailable.');
          const payload = await response.json() as { data?: ExpoTicket[] };
          if (!Array.isArray(payload.data) || payload.data.length !== tokens.length) throw new Error('Invalid push acknowledgement.');
          let retry = false;
          for (let i = 0; i < tokens.length; i++) {
            const ticket = payload.data[i];
            if (ticket?.status === 'ok' && typeof ticket.id === 'string') continue;
            if (ticket?.details?.error === 'DeviceNotRegistered') await this.prisma.pushToken.deleteMany({ where: { id: tokens[i]!.id, userId: job.userId, token: tokens[i]!.token } });
            else retry = true;
          }
          if (retry) throw new Error('Push provider deferred delivery.');
          await finish();
        } catch {
          // Provider failures never roll back a friendship or expose tokens.
          await this.prisma.friendNotification.updateMany({ where: { id: job.id, claimedUntil: claim }, data: { claimedUntil: null,
            availableAt: new Date(Date.now() + Math.min(3_600_000, 60_000 * 2 ** job.attempts)), ...(job.attempts >= 7 ? { completedAt: new Date() } : {}) } });
        }
      }
    } finally { this.running = false;if(this.queued){this.queued=false;this.wake();} }
  }
}
