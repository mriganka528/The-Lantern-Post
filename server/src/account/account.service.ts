import { PalaceEvents } from '../realtime/palace-events';
import { BadRequestException, HttpException, Inject, Injectable, Optional, ServiceUnavailableException } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import { VoiceAssetsService } from '../voice/voice-assets.service';
import { deletionSubjectHash } from './account-access';
import { IdentityRemoval } from './identity-removal';
export const DRIVE_ACCOUNT_CLEANUP = Symbol('DRIVE_ACCOUNT_CLEANUP');
export interface DriveAccountCleanup { eraseOwner(ownerId: string): Promise<void>; }
const summary = (job: { id: string; ownerId: string; state: string; requestedAt: Date; completedAt: Date | null }) => ({ id: job.id, ownerId: job.ownerId, state: job.state as 'PENDING' | 'COMPLETE', requestedAt: job.requestedAt.toISOString(), completedAt: job.completedAt?.toISOString() ?? null });
@Injectable()
export class AccountService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined; private busy = false;
  constructor(private prisma: PrismaService, private identity: IdentityRemoval, private voice: VoiceAssetsService, @Optional() @Inject(DRIVE_ACCOUNT_CLEANUP) private drive?: DriveAccountCleanup, @Optional() private events?:PalaceEvents) {}
  onModuleInit() { this.timer = setInterval(() => { void this.sweep().catch(() => {}); }, 15000); this.timer.unref(); }
  onModuleDestroy() { clearInterval(this.timer); }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 }); }
    catch (error) { if (error instanceof HttpException) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code) && attempt < 3) continue; throw new ServiceUnavailableException({ code: 'DELETION_UNCONFIRMED', message: 'Account removal could not be confirmed. Check its status before trying again.' }); }
    throw new ServiceUnavailableException();
  }
  async status(subject: string) {
    const job = await this.prisma.accountDeletion.findUnique({ where: { subjectHash: deletionSubjectHash(subject) } });
    if (job) return { deletion: summary(job) };
    const user = await this.prisma.user.findUnique({ where: { authProviderId: subject }, select: { id: true } });
    return { deletion: null, ownerId: user?.id ?? null };
  }
  async request(subject: string, requestId: string, confirmation: string) {
    const subjectHash = deletionSubjectHash(subject);
    const job = await this.transaction(async tx => {
      const old = await tx.accountDeletion.findUnique({ where: { subjectHash } }); if (old) return old;
      const owner = await tx.user.findUnique({ where: { authProviderId: subject } });
      if (!owner || owner.accountState !== 'ACTIVE' || owner.username !== confirmation) throw new BadRequestException({ code: 'DELETION_CONFIRMATION', message: 'Type your current username to confirm.' });
      const now = new Date();
      const jobs = await tx.accountDeletion.create({ data: { id: requestId, ownerId: owner.id, subjectHash, providerSubject: subject, diagnosticsKey: owner.diagnosticsKey } });
      // One transaction closes access and removes readable content. External
      // cleanup is durable and may take longer; receipts/audit stubs remain.
      await tx.user.update({ where: { id: owner.id }, data: { accountState: 'DELETING', username: 'departed_' + randomUUID().replaceAll('-', '').slice(0, 15), characterId: null, palaceTheme: null, diagnosticsEnabled: false, diagnosticsKey: null, diagnosticsSince: null } });
      if (owner.diagnosticsKey) await tx.diagnosticsEvent.deleteMany({ where: { actorKey: owner.diagnosticsKey } });
      const pairs = { OR: [{ fromUserId: owner.id }, { toUserId: owner.id }] };
      const requests = await tx.friendRequest.findMany({ where: pairs, select: { id: true,fromUserId:true,toUserId:true } });
      const letters = await tx.letter.findMany({ where: { OR: [{ senderId: owner.id }, { recipientId: owner.id }] }, select: { id: true } });
      await tx.friendNotification.deleteMany({ where: { OR: [{ userId: owner.id }, { requestId: { in: requests.map(row => row.id) } }, { letterId: { in: letters.map(row => row.id) } }] } });
      await tx.pushToken.deleteMany({ where: { userId: owner.id } });
      await tx.friendRequest.updateMany({ where: pairs, data: { status: 'BLOCKED', respondedAt: now } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: owner.id }, { blockedId: owner.id }] } });
      await tx.letter.updateMany({ where: { id: { in: letters.map(row => row.id) } }, data: { textContent: null, voiceCaption: null, audioUrl: null, audioDurationMs: null, voiceAssetId: null, stationeryJson: Prisma.DbNull, isSigned: false, posX: null, posY: null, moderationPassed: null, status: 'HARD_DELETED', softDeletedAt: now, hardDeleteAfter: now } });
      await tx.voiceAsset.updateMany({ where: { OR: [{ ownerId: owner.id }, { recipientId: owner.id }] }, data: { status: 'DELETED', sha256: null, purgeAfter: now } });
      const threads = await tx.chatThread.findMany({ where: { OR: [{ firstUserId: owner.id }, { secondUserId: owner.id }] }, select: { id: true } });
      const messages = await tx.chatMessage.findMany({ where: { threadId: { in: threads.map(row => row.id) } }, select: { id: true } });
      await tx.friendNotification.deleteMany({where:{chatMessageId:{in:messages.map(row=>row.id)}}});
      await tx.palaceEvent.deleteMany({where:{ownerId:owner.id}});
      await this.events?.append(tx,[...new Set(requests.flatMap(row=>[row.fromUserId,row.toUserId]).filter(id=>id!==owner.id))].map(ownerId=>({ownerId,kind:'GATES_CHANGED' as const})));
      await tx.chatMessage.updateMany({ where: { threadId: { in: threads.map(row => row.id) } }, data: { text: '', erasedAt: now } });
      await tx.report.updateMany({ where: { OR: [{ reporterId: owner.id }, { reportedUserId: owner.id }, { letterId: { in: letters.map(row => row.id) } }] }, data: { detail: null } });
      await tx.chatReport.updateMany({ where: { OR: [{ reporterId: owner.id }, { messageId: { in: messages.map(row => row.id) } }] }, data: { detail: null } });
      await tx.driveLink.updateMany({ where: { ownerId: owner.id, status: 'PENDING' }, data: { status: 'CANCELLED', encryptedVerifier: null } });
      return jobs;
    });
    this.events?.notifyAll();return { deletion: summary(job) };
  }
  async sweep() {
    if (this.busy) return; this.busy = true;
    try {
      const now = new Date();
      const jobs = await this.prisma.accountDeletion.findMany({ where: { state: 'PENDING', availableAt: { lte: now }, OR: [{ claimedUntil: null }, { claimedUntil: { lt: now } }] }, take: 5 });
      for (const job of jobs) {
        const claim = new Date(Date.now() + 90000);
        const acquired = await this.prisma.accountDeletion.updateMany({ where: { id: job.id, state: 'PENDING', OR: [{ claimedUntil: null }, { claimedUntil: { lt: now } }] }, data: { claimedUntil: claim, attempts: { increment: 1 } } });
        if (!acquired.count) continue;
        let code = 'CLEANUP_PENDING';
        try {
          if (await this.prisma.driveConnection.findUnique({ where: { ownerId: job.ownerId } }) || await this.prisma.driveLink.findFirst({where:{ownerId:job.ownerId}})) { code = 'DRIVE_CLEANUP_PENDING'; if (!this.drive) throw Error(); await this.drive.eraseOwner(job.ownerId); }
          if (job.providerSubject) { code = 'IDENTITY_CLEANUP_PENDING'; await this.identity.remove(job.providerSubject); await this.prisma.accountDeletion.update({ where: { id: job.id }, data: { providerSubject: null } }); }
          code = 'VOICE_CLEANUP_PENDING'; await this.voice.cleanup();
          const assets = await this.prisma.voiceAsset.findMany({ where: { OR: [{ ownerId: job.ownerId }, { recipientId: job.ownerId }] }, select: { id: true, contentClearedAt: true, stageClearedAt: true } });
          if (assets.some(asset => !asset.contentClearedAt || !asset.stageClearedAt)) throw Error();
          await this.transaction(async tx => {
            if (job.diagnosticsKey) await tx.diagnosticsEvent.deleteMany({ where: { actorKey: job.diagnosticsKey } });
            await tx.voiceAsset.deleteMany({ where: { id: { in: assets.map(asset => asset.id) } } });
            await tx.friendRequest.deleteMany({ where: { OR: [{ fromUserId: job.ownerId }, { toUserId: job.ownerId }] } });
            await tx.driveLink.deleteMany({ where: { ownerId: job.ownerId } });
            await tx.user.update({ where: { id: job.ownerId }, data: { accountState: 'DELETED', authProviderId: 'deleted_' + createHash('sha256').update(job.id).digest('hex') } });
            await tx.accountDeletion.update({ where: { id: job.id }, data: { state: 'COMPLETE', completedAt: new Date(), providerSubject: null, diagnosticsKey: null, claimedUntil: null, errorCode: null } });
          });
        } catch { await this.prisma.accountDeletion.updateMany({ where: { id: job.id, claimedUntil: claim }, data: { claimedUntil: null, availableAt: new Date(Date.now() + Math.min(3600000, 15000 * 2 ** Math.min(job.attempts, 8))), errorCode: code } }); }
      }
    } finally { this.busy = false; }
  }
}
