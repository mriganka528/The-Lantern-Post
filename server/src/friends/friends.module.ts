import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { FriendsController } from './friends.controller';
import { FriendsService } from './friends.service';

@Module({ imports: [AuthModule, DatabaseModule], controllers: [FriendsController], providers: [FriendsService] })
export class FriendsModule {}
