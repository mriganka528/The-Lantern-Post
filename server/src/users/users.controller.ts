import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiConflictResponse, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { SelfResponse, UsernameAvailabilityResponse } from '@lantern-post/shared-types';
import type { AuthIdentity } from '../auth/auth.identity';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import { CreateProfileDto, SelfResponseDto, UsernameAvailabilityDto, UsernameQueryDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('identity')
@ApiBearerAuth('clerk-session')
@ApiUnauthorizedResponse({ description: 'A valid Clerk session is required.' })
@ApiServiceUnavailableResponse({ description: 'Authentication is not configured.' })
@UseGuards(ClerkAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated account owner’s profile' })
  @ApiOkResponse({ type: SelfResponseDto })
  async me(@CurrentIdentity() identity: AuthIdentity): Promise<SelfResponse> {
    return { user: await this.users.findSelf(identity.subject) };
  }

  @Get('username-availability')
  @ApiOperation({ summary: 'Check a canonical username before onboarding; creation still enforces uniqueness' })
  @ApiOkResponse({ type: UsernameAvailabilityDto })
  @ApiBadRequestResponse({ description: 'Use 3–24 letters, numbers, or underscores.' })
  async usernameAvailability(@Query() query: UsernameQueryDto): Promise<UsernameAvailabilityResponse> {
    return { username: query.username, available: await this.users.isUsernameAvailable(query.username) };
  }

  @Post('me')
  @HttpCode(200)
  @ApiOperation({ summary: 'Create the initial profile; repeating the same request is safe' })
  @ApiOkResponse({ type: SelfResponseDto })
  @ApiBadRequestResponse({ description: 'A valid username and 13+ confirmation are required; extra fields are rejected.' })
  @ApiConflictResponse({ description: 'The username is taken, or this identity has already chosen a different username.' })
  async onboard(@CurrentIdentity() identity: AuthIdentity, @Body() input: CreateProfileDto): Promise<SelfResponse> {
    return { user: await this.users.createProfile(identity.subject, input.username) };
  }
}
