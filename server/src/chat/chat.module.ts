import { PalaceEventsModule } from '../realtime/palace-events';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { ModerationModule } from '../letters/moderation.module';
import { SafetyModule } from '../safety/safety.module';
import { RequestLimitsModule } from '../safety/request-limits';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatSignal } from './chat-signal';
import { ChatSocket } from './chat-socket';
import { AccountAccessModule } from '../account/account-access';
@Module({ imports: [PalaceEventsModule, ConfigModule, AuthModule, AccountAccessModule, DatabaseModule, ModerationModule, SafetyModule, RequestLimitsModule], controllers: [ChatController], providers: [ChatService, ChatSignal, ChatSocket], exports: [ChatService] })
export class ChatModule {}
