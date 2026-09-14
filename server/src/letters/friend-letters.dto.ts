import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { Equals, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, Validate, validateSync } from 'class-validator';
import type { DeliveryReceipt, FriendTextLetterRequest, FriendVoiceLetterRequest, LetterBox } from '@lantern-post/shared-types';
import { BurnLetterDto, BurnRequestIdDto, BurnVoiceLetterDto, LetterText } from './letters.dto';
import { WorldTextDto, WorldVoiceDto } from '../infinity/infinity.dto';

export class DeliveryRecipientDto {
  @ApiProperty() @IsString() @Length(1, 100) @Matches(/^[a-zA-Z0-9_-]+$/) recipientId!: string;
}
export class FriendLetterDto extends BurnRequestIdDto implements FriendTextLetterRequest {
  @ApiProperty({ enum: ['TEXT'] }) @Equals('TEXT') type!: 'TEXT';
  @ApiProperty({ enum: ['FRIEND'] }) @Equals('FRIEND') destinationType!: 'FRIEND';
  @ApiProperty({ maxLength: 2000 }) @IsString() @Validate(LetterText) textContent!: string;
  @ApiProperty() @IsString() @Length(1, 64) @Matches(/^[a-zA-Z0-9_-]+$/) presetId!: string;
  @ApiProperty() @IsString() @Length(1, 100) @Matches(/^[a-zA-Z0-9_-]+$/) recipientId!: string;
  @ApiProperty({ enum: [true], type: Boolean }) @IsBoolean() @Equals(true) deliveryConfirmed!: true;
}
export class FriendVoiceLetterDto extends BurnRequestIdDto implements FriendVoiceLetterRequest {
  @ApiProperty({ enum: ['VOICE'] }) @Equals('VOICE') type!: 'VOICE';
  @ApiProperty({ enum: ['FRIEND'] }) @Equals('FRIEND') destinationType!: 'FRIEND';
  @ApiProperty() @IsString() @Length(1, 64) @Matches(/^[a-zA-Z0-9_-]+$/) presetId!: string;
  @ApiProperty() @IsString() @Length(1, 100) @Matches(/^[a-zA-Z0-9_-]+$/) recipientId!: string;
  @ApiProperty({ enum: [true] }) @IsBoolean() @Equals(true) deliveryConfirmed!: true;
  @ApiProperty() @IsString() @Matches(/^voice_[a-f0-9]{64}$/) voiceAssetId!: string;
  @ApiPropertyOptional({ maxLength: 2000 }) @IsOptional() @IsString() @Validate(LetterText) voiceCaption?: string;
}
export class LetterIdDto {
  @ApiProperty() @IsString() @Length(1, 100) @Matches(/^[a-zA-Z0-9_-]+$/) id!: string;
}
export class LetterBoxDto {
  @ApiPropertyOptional({ enum: ['received', 'sent'] }) @IsOptional() @IsIn(['received', 'sent']) box: LetterBox = 'received';
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 256) @Matches(/^[A-Za-z0-9_-]+$/) cursor?: string;
}
export class DeliveryReceiptDto implements DeliveryReceipt {
  @ApiProperty() requestId!: string;
  @ApiProperty() receiptId!: string;
  @ApiProperty() recipientId!: string;
  @ApiProperty({ enum: ['DELIVERED', 'REJECTED'] }) outcome!: DeliveryReceipt['outcome'];
  @ApiProperty({ nullable: true }) reason!: DeliveryReceipt['reason'];
  @ApiProperty({ nullable: true }) letterId!: string | null;
  @ApiProperty({ format: 'date-time' }) completedAt!: string;
}
// Validate each destination against its own strict schema. A FRIEND body
// cannot carry burn flags, moderation results, sender identity, voice or URLs.
export function validateLetterInput(value: unknown): BurnLetterDto | BurnVoiceLetterDto | FriendLetterDto | FriendVoiceLetterDto | WorldTextDto | WorldVoiceDto {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('destinationType' in value)) throw new BadRequestException('Invalid letter.');
  let input: BurnLetterDto | BurnVoiceLetterDto | FriendLetterDto | FriendVoiceLetterDto | WorldTextDto | WorldVoiceDto;
  if (value.destinationType === 'BURNING') input = 'type' in value && value.type === 'VOICE' ? plainToInstance(BurnVoiceLetterDto, value) : plainToInstance(BurnLetterDto, value);
  else if (value.destinationType === 'FRIEND') input = 'type' in value && value.type === 'VOICE' ? plainToInstance(FriendVoiceLetterDto, value) : plainToInstance(FriendLetterDto, value);
  else if (value.destinationType === 'INFINITY') input = 'type' in value && value.type === 'VOICE' ? plainToInstance(WorldVoiceDto, value) : plainToInstance(WorldTextDto, value);
  else throw new BadRequestException('Unsupported letter destination.');
  if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException('Check the letter details and try again.');
  return input;
}
