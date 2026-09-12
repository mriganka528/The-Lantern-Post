import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { AuthIdentity } from '../auth/auth.identity';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import { FriendIdDto, FriendListDto, FriendSearchDto, RespondFriendDto, SendFriendDto } from './friends.dto';
import { FriendsService } from './friends.service';

@ApiTags('friends') @ApiBearerAuth('clerk-session') @UseGuards(ClerkAuthGuard)
@ApiUnauthorizedResponse({ description: 'A verified Clerk session is required.' })
@Controller('friends')
export class FriendsController {
  constructor(private readonly friends: FriendsService) {}
  @Get('search') @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Find up to 20 palaces by username prefix; excludes yourself and blocked accounts' })
  search(@CurrentIdentity() identity: AuthIdentity, @Query() query: FriendSearchDto) { return this.friends.search(identity.subject, query.username); }
  @Get('summary') @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Your friend and invitation counts' })
  summary(@CurrentIdentity() identity: AuthIdentity) { return this.friends.summary(identity.subject); }
  @Get() @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Your friends, received invitations, or sent invitations; 24 items per page' })
  list(@CurrentIdentity() identity: AuthIdentity, @Query() query: FriendListDto) { return this.friends.list(identity.subject, query.view, query.cursor); }
  @Post('requests') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Send an invitation by username; retries and crossed requests reuse the existing invitation' })
  send(@CurrentIdentity() identity: AuthIdentity, @Body() input: SendFriendDto) { return this.friends.send(identity.subject, input.username); }
  @Post('requests/:id/respond') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Accept or decline an invitation addressed to you' })
  respond(@CurrentIdentity() identity: AuthIdentity, @Param() params: FriendIdDto, @Body() input: RespondFriendDto) { return this.friends.respond(identity.subject, params.id, input.action); }
}
