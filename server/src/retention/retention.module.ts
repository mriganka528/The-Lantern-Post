import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RetentionService } from './retention.service';
@Module({ imports: [DatabaseModule], providers: [RetentionService] })
export class RetentionModule {}
