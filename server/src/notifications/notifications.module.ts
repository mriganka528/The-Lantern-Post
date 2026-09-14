import { PalaceEventsModule } from '../realtime/palace-events';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { RequestLimitsModule } from '../safety/request-limits';
@Module({ imports: [PalaceEventsModule, AuthModule, DatabaseModule, ConfigModule, RequestLimitsModule], controllers: [NotificationsController], providers: [NotificationsService] })
export class NotificationsModule {}
