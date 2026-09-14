import { Equals, IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { LetterReportReason } from '@lantern-post/shared-types';
export class SafetyIdDto { @ApiProperty() @IsString() @Matches(/^[a-zA-Z0-9_-]{1,100}$/) id!: string; }
export class BlockPalaceDto { @ApiProperty({ enum: [true] }) @Equals(true) confirmed!: true; }
export class SafetyListDto { @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(350) cursor?: string; }
export class ReportLetterDto {
  @ApiProperty({ enum: ['HARASSMENT', 'SPAM', 'HATE_SPEECH', 'SELF_HARM_CONCERN', 'OTHER'] })
  @IsIn(['HARASSMENT', 'SPAM', 'HATE_SPEECH', 'SELF_HARM_CONCERN', 'OTHER']) reason!: LetterReportReason;
  @ApiPropertyOptional({ maxLength: 1000 }) @IsOptional() @IsString() @MaxLength(1000) @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value) detail?: string;
  @ApiProperty() @IsBoolean() blockSender!: boolean;
  @ApiProperty({ enum: [true] }) @Equals(true) confirmed!: true;
}
