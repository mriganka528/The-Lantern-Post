import { PalaceEventsModule } from '../realtime/palace-events';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { LettersController } from './letters.controller';
import { LettersService } from './letters.service';
import { FriendLettersService } from './friend-letters.service';
import { FriendLettersController } from './friend-letters.controller';
import { ModerationModule } from './moderation.module';
import { InfinityModule } from '../infinity/infinity.module';
import { VoiceModule } from '../voice/voice.module';
import { RequestLimitsModule } from '../safety/request-limits';

@Module({ imports: [PalaceEventsModule, AuthModule, DatabaseModule, VoiceModule, RequestLimitsModule, ModerationModule, InfinityModule], controllers: [LettersController, FriendLettersController], providers: [LettersService, FriendLettersService] })
export class LettersModule {}
