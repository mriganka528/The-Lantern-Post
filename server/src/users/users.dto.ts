import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import type { TransformFnParams } from 'class-transformer';
import { Equals, IsBoolean, IsString, Length, Matches } from 'class-validator';
import type { CreateProfileRequest, SelfProfile, SelfResponse, UsernameAvailabilityResponse } from '@lantern-post/shared-types';

export class UsernameQueryDto {
  @ApiProperty({ minLength: 3, maxLength: 24, pattern: '^[a-z0-9_]+$', description: 'Trimmed and lowercased before validation.' })
  @Transform(({ value }: TransformFnParams) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString()
  @Length(3, 24)
  @Matches(/^[a-z0-9_]+$/)
  username!: string;
}

export class CreateProfileDto extends UsernameQueryDto implements CreateProfileRequest {
  @ApiProperty({ type: Boolean, example: true, description: 'Must be true: the user confirms they are at least 13 years old.' })
  @IsBoolean()
  @Equals(true, { message: 'Confirm that you are at least 13 years old.' })
  minimumAgeConfirmed!: boolean;
}

export class UsernameAvailabilityDto implements UsernameAvailabilityResponse {
  @ApiProperty()
  username!: string;

  @ApiProperty()
  available!: boolean;
}

export class SelfProfileDto implements SelfProfile {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty({ type: String, nullable: true })
  characterId!: string | null;

  @ApiProperty({ type: String, nullable: true })
  palaceTheme!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class SelfResponseDto implements SelfResponse {
  @ApiProperty({ type: SelfProfileDto, nullable: true, description: 'Null means this identity has not chosen a Lantern Post username yet.' })
  user!: SelfProfileDto | null;
}
