import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined; private running = false;
  constructor(private readonly prisma: PrismaService) {}
  onModuleInit() { this.timer = setInterval(() => { void this.sweep().catch(() => {}); }, 60000); this.timer.unref(); }
  onModuleDestroy() { clearInterval(this.timer); }
  async sweep(now = new Date(), ownerIds?: string[]) {
    if (this.running) return; this.running = true;
    const ownership = ownerIds ? { senderId: { in: ownerIds } } : {};
    try {
      const due = await this.prisma.letter.findMany({ where: { ...ownership, status: 'SOFT_DELETED', hardDeleteAfter: { lte: now } }, select: { id: true }, take: 50, orderBy: { hardDeleteAfter: 'asc' } });
      for (const item of due) await this.prisma.$transaction(async tx => {
        const letter = await tx.letter.findFirst({ where: { id: item.id, status: 'SOFT_DELETED', hardDeleteAfter: { lte: now } }, select: { id: true, voiceAssetId: true } }); if (!letter) return;
        await tx.letter.update({ where: { id: letter.id }, data: { status: 'HARD_DELETED', textContent: null, audioUrl: null, audioDurationMs: null, voiceAssetId: null, voiceCaption: null, stationeryJson: Prisma.DbNull, moderationPassed: null, posX: null, posY: null } });
        if (letter.voiceAssetId) await tx.voiceAsset.update({ where: { id: letter.voiceAssetId }, data: { status: 'DELETED', sha256: null, purgeAfter: now } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      // Never purge receipts: retries, cancellations and daily limits rely on them.
      // Reported rows retain only their cleared audit stub for the report FK.
      const old = await this.prisma.letter.findMany({ where: { ...ownership, status: 'HARD_DELETED', hardDeleteAfter: { lte: new Date(now.getTime() - 30 * 86400000) }, textContent: null, voiceAssetId: null, audioUrl: null, voiceCaption: null, reports: { none: {} } }, select: { id: true }, take: 50 });
      if (old.length) await this.prisma.letter.deleteMany({ where: { id: { in: old.map(row => row.id) }, status: 'HARD_DELETED', reports: { none: {} } } });
    } finally { this.running = false; }
  }
}
