import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { validateEnvironment } from './config/environment';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { CharactersModule } from './characters/characters.module';
import { PresetsModule } from './presets/presets.module';
import { LettersModule } from './letters/letters.module';
import { FriendsModule } from './friends/friends.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SafetyModule } from './safety/safety.module';
import { RetentionModule } from './retention/retention.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';
import { ChatModule } from './chat/chat.module';
import { AccountModule } from './account/account.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // AppModule lives in src/ or dist/; both resolve to the same .env files.
      envFilePath: resolve(__dirname, '../.env'),
      validate: validateEnvironment,
    }),
    HealthModule,
    UsersModule,
    CharactersModule,
    PresetsModule,
    LettersModule,
    FriendsModule,
    NotificationsModule,
    SafetyModule,
    RetentionModule,
    DiagnosticsModule,
    ChatModule,
    AccountModule,
  ],
})
export class AppModule {}
