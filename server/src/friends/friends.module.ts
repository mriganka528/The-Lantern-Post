import { PalaceEventsModule } from '../realtime/palace-events';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';
import { RequestLimitsModule } from '../safety/request-limits';

@Module({ imports: [PalaceEventsModule, AuthModule, DatabaseModule, RequestLimitsModule], controllers: [FriendsController], providers: [FriendsService] })
export class FriendsModule {}
