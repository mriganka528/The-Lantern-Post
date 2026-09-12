import { Injectable } from '@nestjs/common';
import type { LetterPreset } from '@lantern-post/shared-types';
import { PrismaService } from '../database/prisma.service';
import { serializePreset } from './preset';

@Injectable()
export class PresetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<LetterPreset[]> {
    const rows = await this.prisma.preset.findMany({
      where: { isActive: true }, select: { id: true, key: true, displayName: true, configJson: true },
    });
    return rows.flatMap(row => {
      const preset = serializePreset(row);
      return preset ? [preset] : [];
    }).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key))
      .map(({ id, key, displayName, description, config }) => ({ id, key, displayName, description, config }));
  }
}
