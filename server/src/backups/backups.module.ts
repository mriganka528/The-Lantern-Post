import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { DatabaseModule } from '../database/database.module';
import { RequestLimitsModule } from '../safety/request-limits';
import { DRIVE_ACCOUNT_CLEANUP } from '../account/account.service';
import { BackupsController, DriveCallbackController } from './backups.controller';
import { BackupsService } from './backups.service';
import { DriveService } from './drive.service';
@Module({ imports: [ConfigModule,AuthModule,DatabaseModule,RequestLimitsModule], controllers: [BackupsController,DriveCallbackController], providers: [BackupsService,DriveService,{ provide: DRIVE_ACCOUNT_CLEANUP, useExisting: DriveService }], exports: [DRIVE_ACCOUNT_CLEANUP,DriveService] })
export class BackupsModule {}
