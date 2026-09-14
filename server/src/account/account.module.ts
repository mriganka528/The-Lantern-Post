import { PalaceEventsModule } from '../realtime/palace-events';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { VoiceModule } from '../voice/voice.module';
import { RequestLimitsModule } from '../safety/request-limits';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { IdentityRemoval } from './identity-removal';
import { BackupsModule } from '../backups/backups.module';
@Module({ imports: [PalaceEventsModule, ConfigModule, AuthModule, DatabaseModule, VoiceModule, RequestLimitsModule, BackupsModule], controllers: [AccountController], providers: [AccountService, IdentityRemoval], exports: [AccountService] })
export class AccountModule {}
