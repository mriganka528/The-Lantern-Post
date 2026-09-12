import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { LettersController } from './letters.controller';
import { LettersService } from './letters.service';
import { FriendLettersService } from './friend-letters.service';
import { FriendLettersController } from './friend-letters.controller';
import { LetterModerationService } from './letter-moderation.service';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [LettersController, FriendLettersController], providers: [LettersService, FriendLettersService, LetterModerationService] })
export class LettersModule {}
