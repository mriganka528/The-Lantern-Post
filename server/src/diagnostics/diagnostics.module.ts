import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RequestLimitsModule } from '../safety/request-limits';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
@Module({ imports: [ConfigModule, AuthModule, DatabaseModule, RequestLimitsModule], controllers: [DiagnosticsController], providers: [DiagnosticsService] })
export class DiagnosticsModule {}
