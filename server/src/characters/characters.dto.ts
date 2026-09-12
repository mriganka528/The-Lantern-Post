import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';
import type { CharacterDetails, CharacterKey, CharactersResponse, ChooseCharacterRequest, PalaceDetails, PalaceResponse, PalaceTheme } from '@lantern-post/shared-types';

export class ChooseCharacterDto implements ChooseCharacterRequest {
  @ApiProperty({ example: 'char_fox_lantern', maxLength: 64 })
  @IsString()
  @Length(1, 64)
  @Matches(/^[a-zA-Z0-9_-]+$/)
  characterId!: string;
}

class PalaceDetailsDto implements PalaceDetails {
  @ApiProperty() theme!: PalaceTheme;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
}

export class CharacterDetailsDto implements CharacterDetails {
  @ApiProperty() id!: string;
  @ApiProperty() key!: CharacterKey;
  @ApiProperty() displayName!: string;
  @ApiProperty({ description: 'Bundled artwork identifier; not a remote download URL.' }) assetUrl!: string;
  @ApiProperty() title!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: PalaceDetailsDto }) palace!: PalaceDetails;
}

export class CharactersResponseDto implements CharactersResponse {
  @ApiProperty({ type: [CharacterDetailsDto] }) characters!: CharacterDetails[];
}

export class PalaceResponseDto implements PalaceResponse {
  @ApiProperty({ type: CharacterDetailsDto, nullable: true }) character!: CharacterDetails | null;
}
