import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsIn, IsInt, IsString, IsUUID, Length, Matches, Max, Min, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import type { VoiceUploadRequest, WorldVoiceUploadRequest } from '@lantern-post/shared-types';
import { MAX_VOICE_BYTES, MAX_VOICE_MS } from './voice-limits';
class VoiceMetadataDto {
  @ApiProperty() @IsUUID('4') requestId!: string;
  @ApiProperty({ enum: ['audio/webm', 'audio/mp4'] }) @IsIn(['audio/webm', 'audio/mp4']) mimeType!: 'audio/webm' | 'audio/mp4';
  @ApiProperty() @IsInt() @Min(64) @Max(MAX_VOICE_BYTES) byteLength!: number;
  @ApiProperty() @IsInt() @Min(1000) @Max(MAX_VOICE_MS) durationMs!: number;
  @ApiProperty() @IsString() @Matches(/^[A-Za-z0-9+/]{43}=$/) sha256!: string;
}
export class VoiceUploadDto extends VoiceMetadataDto implements VoiceUploadRequest {
  @ApiProperty() @IsString() @Length(1, 100) @Matches(/^[a-zA-Z0-9_-]+$/) recipientId!: string;
}
export class WorldVoiceUploadDto extends VoiceMetadataDto implements WorldVoiceUploadRequest {
  @ApiProperty({ enum: ['INFINITY'] }) @Equals('INFINITY') destinationType!: 'INFINITY';
}
export function validateVoiceUpload(value: unknown): VoiceUploadDto | WorldVoiceUploadDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Invalid voice upload.');
  const input = 'destinationType' in value ? plainToInstance(WorldVoiceUploadDto, value) : plainToInstance(VoiceUploadDto, value);
  if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true }).length) throw new BadRequestException('Check the voice upload details.'); return input;
}
export class VoiceAssetIdDto { @ApiProperty() @IsString() @Matches(/^voice_[a-f0-9]{64}$/) id!: string; }
