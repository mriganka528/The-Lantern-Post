import { PalaceEventsModule } from '../realtime/palace-events';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RequestLimitsModule } from './request-limits';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
@Module({ imports: [PalaceEventsModule, AuthModule, DatabaseModule, RequestLimitsModule], controllers: [SafetyController], providers: [SafetyService], exports: [SafetyService] })
export class SafetyModule {}
