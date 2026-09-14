import { BadRequestException } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import type { DiagnosticsInput } from '@lantern-post/shared-types';
export class DiagnosticsPreferencesDto { @ApiProperty() @IsBoolean() enabled!: boolean; }
export class DiagnosticsEventDto implements DiagnosticsInput {
  @ApiProperty() @IsUUID('4') eventId!: string;
  @ApiProperty({ enum: ['SESSION_OPEN','DRAFT_SEALED','BURN_COMPLETED','FRIEND_DELIVERED','WORLD_SHARED','CLIENT_ERROR'] }) @IsIn(['SESSION_OPEN','DRAFT_SEALED','BURN_COMPLETED','FRIEND_DELIVERED','WORLD_SHARED','CLIENT_ERROR']) name!: DiagnosticsInput['name'];
  @ApiProperty({ enum: ['web','ios','android'] }) @IsIn(['web','ios','android']) platform!: DiagnosticsInput['platform'];
  @ApiPropertyOptional() @IsOptional() @IsUUID('4') requestId?: string;
  @ApiPropertyOptional({ enum: ['RENDER_ERROR','UNHANDLED_ERROR'] }) @IsOptional() @IsIn(['RENDER_ERROR','UNHANDLED_ERROR']) code?: DiagnosticsInput['code'];
}
export function validateDiagnostic(value: unknown): DiagnosticsEventDto {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Invalid diagnostic event.');
  const input = plainToInstance(DiagnosticsEventDto, value);
  if (validateSync(input, { whitelist: true, forbidNonWhitelisted: true }).length || (input.name === 'CLIENT_ERROR' ? !input.code : input.code !== undefined) || (['BURN_COMPLETED','FRIEND_DELIVERED','WORLD_SHARED'].includes(input.name) ? !input.requestId : input.requestId !== undefined)) throw new BadRequestException('Invalid diagnostic event.');
  return input;
}
