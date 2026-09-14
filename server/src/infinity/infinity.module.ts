import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { VoiceModule } from '../voice/voice.module';
import { ModerationModule } from '../letters/moderation.module';
import { SafetyModule } from '../safety/safety.module';
import { RequestLimitsModule } from '../safety/request-limits';
import { InfinityController } from './infinity.controller';
import { InfinityService } from './infinity.service';
@Module({ imports: [AuthModule, DatabaseModule, VoiceModule, ModerationModule, SafetyModule, RequestLimitsModule], controllers: [InfinityController], providers: [InfinityService], exports: [InfinityService] })
export class InfinityModule {}
