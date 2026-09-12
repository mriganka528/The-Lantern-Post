import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { CharactersResponse, PalaceResponse, SelfResponse } from '@lantern-post/shared-types';
import type { AuthIdentity } from '../auth/auth.identity';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import { SelfResponseDto } from '../users/users.dto';
import { CharactersResponseDto, ChooseCharacterDto, PalaceResponseDto } from './characters.dto';
import { CharactersService } from './characters.service';

@ApiTags('characters')
@ApiBearerAuth('clerk-session')
@ApiUnauthorizedResponse({ description: 'A valid Clerk session is required.' })
@UseGuards(ClerkAuthGuard)
@Controller('characters')
export class CharactersController {
  constructor(private readonly characters: CharactersService) {}

  @Get()
  @ApiOperation({ summary: 'List active companions and their palace stories' })
  @ApiOkResponse({ type: CharactersResponseDto })
  async list(): Promise<CharactersResponse> { return { characters: await this.characters.list() }; }
}

@ApiTags('palace')
@ApiBearerAuth('clerk-session')
@ApiUnauthorizedResponse({ description: 'A valid Clerk session is required.' })
@UseGuards(ClerkAuthGuard)
@Controller('users/me')
export class PalaceController {
  constructor(private readonly characters: CharactersService) {}

  @Get('palace')
  @ApiOperation({ summary: 'Get the signed-in owner’s palace, including a retired companion' })
  @ApiOkResponse({ type: PalaceResponseDto })
  @ApiConflictResponse({ description: 'Choose a username first.' })
  @ApiNotFoundResponse({ description: 'The saved companion is no longer supported by this catalog.' })
  async palace(@CurrentIdentity() identity: AuthIdentity): Promise<PalaceResponse> {
    return this.characters.palace(identity.subject);
  }

  @Post('character')
  @HttpCode(200)
  @ApiOperation({ summary: 'Choose or change your companion and its matching palace; retries are safe' })
  @ApiOkResponse({ type: SelfResponseDto })
  @ApiBadRequestResponse({ description: 'A character ID is required. Extra fields, including identity and theme, are rejected.' })
  @ApiConflictResponse({ description: 'Choose a username first.' })
  @ApiNotFoundResponse({ description: 'The companion is inactive or unavailable.' })
  async choose(@CurrentIdentity() identity: AuthIdentity, @Body() input: ChooseCharacterDto): Promise<SelfResponse> {
    return { user: await this.characters.choose(identity.subject, input.characterId) };
  }
}
