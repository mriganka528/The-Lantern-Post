import { Body, Controller, Get, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { AuthIdentity } from '../auth/auth.identity';
import { PushTokenDto, RegisterPushDto } from '../friends/friends.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications') @ApiBearerAuth('clerk-session') @UseGuards(ClerkAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}
  @Get('settings') @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Whether device push registration is available' })
  settings() { return { enabled: this.notifications.enabled }; }
  @Post('register') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Register this installation for the verified owner; never returns tokens' })
  register(@CurrentIdentity() identity: AuthIdentity, @Body() body: RegisterPushDto) { return this.notifications.register(identity.subject, body); }
  @Post('unregister') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Remove only your own installation token before sign-out or disabling notifications' })
  unregister(@CurrentIdentity() identity: AuthIdentity, @Body() body: PushTokenDto) { return this.notifications.unregister(identity.subject, body.token); }
}
