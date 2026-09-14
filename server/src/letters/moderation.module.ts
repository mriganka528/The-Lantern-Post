import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LetterModerationService } from './letter-moderation.service';
@Module({ imports: [ConfigModule], providers: [LetterModerationService], exports: [LetterModerationService] })
export class ModerationModule {}
