import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsBoolean, IsIn, IsInt, IsString, IsUUID, Length, Matches, Max, Min, Validate, ValidatorConstraint } from 'class-validator';
import type { ValidatorConstraintInterface } from 'class-validator';
import type { BurnTextLetterRequest, BurnVoiceLetterRequest, BurnReceipt, BurnReceiptResponse } from '@lantern-post/shared-types';
import { MAX_VOICE_BYTES, MAX_VOICE_MS } from '../voice/voice-limits';

@ValidatorConstraint({ name: 'letterText', async: false })
export class LetterText implements ValidatorConstraintInterface {
  validate(value: unknown) { return typeof value === 'string' && value.trim().length > 0 && Array.from(value).length <= 2000; }
  defaultMessage() { return 'A text letter must contain 1–2,000 characters and cannot be only whitespace.'; }
}

export class BurnRequestIdDto {
  @ApiProperty({ format: 'uuid', description: 'A new UUID v4 for each explicitly confirmed release. Reuse it only to retry that release.' })
  @IsUUID('4')
  requestId!: string;
}

export class BurnLetterDto extends BurnRequestIdDto implements BurnTextLetterRequest {
  @ApiProperty({ enum: ['TEXT'] })
  @Equals('TEXT')
  type!: 'TEXT';

  @ApiProperty({ enum: ['BURNING'] })
  @Equals('BURNING')
  destinationType!: 'BURNING';

  @ApiProperty({ description: 'Up to 2,000 Unicode code points. Validated in memory and discarded; never written to the database or response.', maxLength: 2000 })
  @IsString()
  @Validate(LetterText)
  textContent!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  presetId!: string;

  @ApiProperty({ type: Boolean, enum: [true], description: 'The user explicitly confirmed this irreversible release.' })
  @IsBoolean()
  @Equals(true)
  burnConfirmed!: true;
}
export class BurnVoiceLetterDto extends BurnRequestIdDto implements BurnVoiceLetterRequest {
  @ApiProperty({ enum: ['VOICE'] }) @Equals('VOICE') type!: 'VOICE';
  @ApiProperty({ enum: ['BURNING'] }) @Equals('BURNING') destinationType!: 'BURNING';
  @ApiProperty() @IsString() @Length(1, 64) @Matches(/^[a-zA-Z0-9_-]+$/) presetId!: string;
  @ApiProperty({ enum: [true] }) @IsBoolean() @Equals(true) burnConfirmed!: true;
  @ApiProperty({ enum: ['audio/webm', 'audio/mp4'] }) @IsIn(['audio/webm', 'audio/mp4']) audioMimeType!: 'audio/webm' | 'audio/mp4';
  @ApiProperty() @IsInt() @Min(64) @Max(MAX_VOICE_BYTES) audioByteLength!: number;
  @ApiProperty() @IsInt() @Min(1000) @Max(MAX_VOICE_MS) audioDurationMs!: number;
}

export class BurnReceiptDto implements BurnReceipt {
  @ApiProperty({ format: 'uuid' }) requestId!: string;
  @ApiProperty() receiptId!: string;
  @ApiProperty({ enum: ['BURNED', 'REJECTED'] }) outcome!: BurnReceipt['outcome'];
  @ApiProperty({ type: String, nullable: true, enum: ['PRESET_UNAVAILABLE'] }) reason!: BurnReceipt['reason'];
  @ApiProperty({ format: 'date-time' }) completedAt!: string;
}
export class BurnReceiptResponseDto implements BurnReceiptResponse {
  @ApiProperty({ type: BurnReceiptDto, nullable: true }) receipt!: BurnReceipt | null;
}
