import { Body, Controller, Get, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { AuthIdentity } from '../auth/auth.identity';
import { PushTokenDto, RegisterPushDto } from '../friends/friends.dto';
import { NotificationsService } from './notifications.service';
import { RequestLimit } from '../safety/request-limits';

@ApiTags('notifications') @ApiBearerAuth('clerk-session') @UseGuards(ClerkAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get('inbox') @Header('Cache-Control', 'no-store') @RequestLimit('notification-inbox', 120)
  @ApiOperation({ summary: 'The latest 50 arrivals from seven days, rechecked for current owner access' })
  inbox(@CurrentIdentity() identity: AuthIdentity) { return this.notifications.inbox(identity.subject); }
  @Get('settings') @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Whether device push registration is available' })
  settings() { return { enabled: this.notifications.enabled }; }
  @Post('register') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Register this installation for the verified owner; never returns tokens' })
  register(@CurrentIdentity() identity: AuthIdentity, @Body() body: RegisterPushDto) { return this.notifications.register(identity.subject, body); }
  @Post('unregister') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Remove only your own installation token before sign-out or disabling notifications' })
  unregister(@CurrentIdentity() identity: AuthIdentity, @Body() body: PushTokenDto) { return this.notifications.unregister(identity.subject, body.token); }
}
