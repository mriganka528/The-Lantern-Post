import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Equals, IsBoolean, IsNumber, IsOptional, IsString, Length, Matches, Max, Min, Validate } from 'class-validator';
import type { WorldBounds, WorldReceipt, WorldTextRequest, WorldVoiceRequest } from '@lantern-post/shared-types';
import { BurnRequestIdDto, LetterText } from '../letters/letters.dto';
class PublicIntentDto extends BurnRequestIdDto {
  @ApiProperty({ enum: ['INFINITY'] }) @Equals('INFINITY') destinationType!: 'INFINITY';
  @ApiProperty() @IsString() @Length(1, 64) @Matches(/^[a-zA-Z0-9_-]+$/) presetId!: string;
  @ApiProperty({ default: false }) @IsBoolean() isSigned!: boolean;
  @ApiProperty({ enum: [true] }) @Equals(true) publicConfirmed!: true;
}
export class WorldTextDto extends PublicIntentDto implements WorldTextRequest {
  @ApiProperty({ enum: ['TEXT'] }) @Equals('TEXT') type!: 'TEXT';
  @ApiProperty({ maxLength: 2000 }) @IsString() @Validate(LetterText) textContent!: string;
}
export class WorldVoiceDto extends PublicIntentDto implements WorldVoiceRequest {
  @ApiProperty({ enum: ['VOICE'] }) @Equals('VOICE') type!: 'VOICE';
  @ApiProperty() @IsString() @Matches(/^voice_[a-f0-9]{64}$/) voiceAssetId!: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @Validate(LetterText) voiceCaption?: string;
}
export class WorldCancelDto { @ApiProperty() @IsBoolean() isSigned!: boolean; }
export class WorldReceiptDto implements WorldReceipt {
  @ApiProperty() requestId!: string;
  @ApiProperty() receiptId!: string;
  @ApiProperty({ enum: ['DELIVERED', 'REJECTED'] }) outcome!: WorldReceipt['outcome'];
  @ApiProperty() isSigned!: boolean;
  @ApiProperty({ nullable: true }) reason!: WorldReceipt['reason'];
  @ApiProperty({ nullable: true }) letterId!: string | null;
  @ApiProperty({ format: 'date-time' }) completedAt!: string;
}
export class WorldCursorDto { @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 600) @Matches(/^[A-Za-z0-9_-]+$/) cursor?: string; }
export class WorldBoundsDto extends WorldCursorDto implements WorldBounds {
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) @Max(1600) minX!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) @Max(1600) maxX!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) @Max(1000) minY!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0) @Max(1000) maxY!: number;
}
