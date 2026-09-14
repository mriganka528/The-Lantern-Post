import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { VoiceController } from './voice.controller';
import { VoiceAssetsService } from './voice-assets.service';
import { VoiceStorageService } from './voice-storage.service';
import { RequestLimitsModule } from '../safety/request-limits';
@Module({ imports: [AuthModule, DatabaseModule, ConfigModule, RequestLimitsModule], controllers: [VoiceController], providers: [VoiceAssetsService, VoiceStorageService], exports: [VoiceAssetsService, VoiceStorageService] })
export class VoiceModule {}
