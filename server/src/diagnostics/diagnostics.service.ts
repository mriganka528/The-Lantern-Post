import { ConflictException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { DiagnosticsInput, DiagnosticsPreferences } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import type { Environment } from '../config/environment';
import { sentryEnvelope } from './diagnostics-contract';
const selectOwner = { id: true, diagnosticsEnabled: true, diagnosticsKey: true, diagnosticsSince: true } as const;
@Injectable()
export class DiagnosticsService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined; private running = false;
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService<Environment, true>) {}
  onModuleInit() { this.timer = setInterval(() => { void this.flush().catch(() => {}); }, 60000); this.timer.unref(); }
  onModuleDestroy() { clearInterval(this.timer); }
  private async transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let i=0;i<4;i++) try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); } catch (error) { if (error instanceof HttpException) throw error; if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002','P2034'].includes(error.code) && i<3) continue; throw new ServiceUnavailableException('Diagnostics could not be saved.'); }
    throw new ServiceUnavailableException();
  }
  async preferences(subject: string): Promise<DiagnosticsPreferences> { const user = await this.prisma.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: selectOwner }); if (!user) throw new ConflictException('Choose your profile first.'); return { enabled: Boolean(user.diagnosticsEnabled) }; }
  async configure(subject: string, enabled: boolean): Promise<DiagnosticsPreferences> {
    return this.transaction(async tx => {
      const user = await tx.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: selectOwner }); if (!user) throw new ConflictException('Choose your profile first.');
      if (!enabled && user.diagnosticsKey) await tx.diagnosticsEvent.deleteMany({ where: { actorKey: user.diagnosticsKey } });
      await tx.user.update({ where: { id: user.id }, data: { diagnosticsEnabled: enabled, diagnosticsKey: enabled ? user.diagnosticsKey ?? randomUUID() : null, diagnosticsSince: enabled ? user.diagnosticsSince ?? new Date() : null } });
      return { enabled };
    });
  }
  async record(subject: string, input: DiagnosticsInput) {
    return this.transaction(async tx => {
      const user = await tx.user.findUnique({ where: { authProviderId: subject, accountState: 'ACTIVE' }, select: selectOwner }); if (!user?.diagnosticsEnabled || !user.diagnosticsKey || !user.diagnosticsSince) return { accepted: false };
      let occurredAt = new Date();
      if (input.requestId) {
        const digest = createHash('sha256').update(`${user.id}\0${input.requestId.toLowerCase()}`).digest('hex');
        const row = input.name === 'BURN_COMPLETED' ? await tx.burnReceipt.findUnique({ where: { id: `burn_${digest}` } }) : input.name === 'FRIEND_DELIVERED' ? await tx.deliveryReceipt.findUnique({ where: { id: `delivery_${digest}` } }) : await tx.worldReceipt.findUnique({ where: { id: `world_${digest}` } });
        if (!row || (row.outcome !== 'BURNED' && row.outcome !== 'DELIVERED') || row.createdAt < user.diagnosticsSince) return { accepted: false }; occurredAt = row.createdAt;
      }
      const id = 'diag_' + createHash('sha256').update(`${user.diagnosticsKey}\0${input.name}\0${(input.requestId ?? input.eventId).toLowerCase()}`).digest('hex');
      await tx.diagnosticsEvent.upsert({ where: { id }, create: { id, actorKey: user.diagnosticsKey, name: input.name, platform: input.platform, code: input.code ?? null, occurredAt }, update: {} }); return { accepted: true };
    });
  }
  async flush(now = new Date()) {
    if (this.running) return; this.running = true;
    try {
      await this.prisma.diagnosticsEvent.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * 86400000) } } });
      const sentry = this.config.get('DIAGNOSTICS_SENTRY'); if (!sentry) return;
      const events = await this.prisma.diagnosticsEvent.findMany({ where: { name: 'CLIENT_ERROR', exportedAt: null, attempts: { lt: 5 }, availableAt: { lte: now } }, take: 10, orderBy: { createdAt: 'asc' } });
      for (const event of events) {
        const active = await this.prisma.user.findFirst({ where: { diagnosticsKey: event.actorKey, diagnosticsEnabled: true }, select: { id: true } }); if (!active) continue;
        const claim = await this.prisma.diagnosticsEvent.updateMany({ where: { id: event.id, exportedAt: null, availableAt: { lte: now } }, data: { attempts: { increment: 1 }, availableAt: new Date(now.getTime() + Math.min(3600000, 60000 * 2 ** event.attempts)) } }); if (!claim.count) continue;
        try { const response = await fetch(sentry.endpoint, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': `Sentry sentry_version=7,sentry_client=lantern-post/0.1.0,sentry_key=${sentry.publicKey}` }, body: sentryEnvelope(event) }); if (response.ok) await this.prisma.diagnosticsEvent.updateMany({ where: { id: event.id }, data: { exportedAt: now } }); } catch { /* Retry fixed codes only; never log private transport details. */ }
      }
    } finally { this.running = false; }
  }
}
