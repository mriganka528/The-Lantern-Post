import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { LetterPreset, PresetsResponse, StationeryConfig } from '@lantern-post/shared-types';

class StationeryConfigDto implements StationeryConfig {
  @ApiProperty({ example: '#F8EED6' }) paperColor!: string;
  @ApiProperty({ example: '#443C2F' }) inkColor!: string;
  @ApiProperty({ example: '#956547' }) sealColor!: string;
  @ApiProperty({ example: '#89977D' }) ribbonColor!: string;
  @ApiProperty({ enum: ['parchment', 'linen', 'vellum'] }) texture!: StationeryConfig['texture'];
  @ApiProperty({ enum: ['stars', 'floral', 'royal', 'postmark', 'lace', 'peacock', 'rose-vine', 'celestial', 'regal', 'gilded'] }) motif!: StationeryConfig['motif'];
  @ApiProperty({ enum: ['book', 'script', 'classic'] }) font!: StationeryConfig['font'];
}
class LetterPresetDto implements LetterPreset {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: StationeryConfigDto }) config!: StationeryConfig;
  @ApiPropertyOptional({ enum: ['royal'] }) collection?: 'royal';
}
export class PresetsResponseDto implements PresetsResponse {
  @ApiProperty({ type: [LetterPresetDto] }) presets!: LetterPreset[];
}
