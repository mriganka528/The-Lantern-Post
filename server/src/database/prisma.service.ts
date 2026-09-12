import { Injectable } from '@nestjs/common';
import type { OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Environment, true>) {
    super({ datasources: { db: { url: config.get('DATABASE_URL') } } });
  }

  // Prisma connects on the first query; liveness stays available during DB outages.
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
