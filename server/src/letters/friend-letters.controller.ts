import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { AuthIdentity } from '../auth/auth.identity';
import { BurnRequestIdDto } from './letters.dto';
import { DeliveryRecipientDto, LetterBoxDto, LetterIdDto } from './friend-letters.dto';
import { FriendLettersService } from './friend-letters.service';

@ApiTags('private letters') @ApiBearerAuth('clerk-session') @UseGuards(ClerkAuthGuard)
@Controller('letters/friends')
export class FriendLettersController {
  constructor(private readonly letters: FriendLettersService) {}
  @Get('capabilities') @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Whether the live letter moderation provider is configured' })
  capabilities() { return this.letters.capabilities(); }
  @Get('summary') @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Your unread, received and sent private-letter counts' })
  summary(@CurrentIdentity() identity: AuthIdentity) { return this.letters.summary(identity.subject); }
  @Get('requests/:requestId') @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Check only your own delivery receipt, without returning letter text' })
  status(@CurrentIdentity() identity: AuthIdentity, @Param() params: BurnRequestIdDto) { return this.letters.status(identity.subject, params.requestId).then(receipt => ({ receipt })); }
  @Post('requests/:requestId/cancel') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Durably cancel an unresolved delivery; if delivery already won, returns its original receipt' })
  cancel(@CurrentIdentity() identity: AuthIdentity, @Param() params: BurnRequestIdDto, @Body() body: DeliveryRecipientDto) { return this.letters.cancel(identity.subject, params.requestId, body.recipientId); }
  @Get() @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Private envelopes in your received or sent box; no letter text; current friendship and blocks are checked' })
  list(@CurrentIdentity() identity: AuthIdentity, @Query() query: LetterBoxDto) { return this.letters.list(identity.subject, query.box, query.cursor); }
  @Post(':id/open') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Open only an authorised private letter; the recipient’s first opening marks it read' })
  open(@CurrentIdentity() identity: AuthIdentity, @Param() params: LetterIdDto) { return this.letters.open(identity.subject, params.id); }
  @Post(':id/delete') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Permanently clear an authorised private letter from both palaces; the delivery receipt remains' })
  remove(@CurrentIdentity() identity: AuthIdentity, @Param() params: LetterIdDto) { return this.letters.remove(identity.subject, params.id); }
}
