import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayUnique, IsArray, IsString, Matches } from 'class-validator';
import type { NotificationStateUpdate } from '@lantern-post/shared-types';

export class NotificationStateDto implements NotificationStateUpdate {
  @ApiProperty({ type: [String], maxItems: 500 }) @IsArray() @ArrayMaxSize(500) @ArrayUnique()
  @IsString({ each: true }) @Matches(/^[A-Za-z0-9_:-]{1,180}$/, { each: true }) seenIds!: string[];

  @ApiProperty({ type: [String], maxItems: 500 }) @IsArray() @ArrayMaxSize(500) @ArrayUnique()
  @IsString({ each: true }) @Matches(/^[A-Za-z0-9_:-]{1,180}$/, { each: true }) dismissedIds!: string[];
}
