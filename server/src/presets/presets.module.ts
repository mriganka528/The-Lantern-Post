import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { PresetsController } from './presets.controller';
import { PresetsService } from './presets.service';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [PresetsController], providers: [PresetsService] })
export class PresetsModule {}
