import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
@Module({ imports: [AuthModule, DatabaseModule, ConfigModule], controllers: [NotificationsController], providers: [NotificationsService] })
export class NotificationsModule {}
