import { Body, Controller, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiExtraModels, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse, getSchemaPath } from '@nestjs/swagger';
import type { BurnReceipt, BurnReceiptResponse, DeliveryReceipt, WorldReceipt } from '@lantern-post/shared-types';
import { InfinityService } from '../infinity/infinity.service';
import { WorldReceiptDto, WorldTextDto, WorldVoiceDto } from '../infinity/infinity.dto';
import type { AuthIdentity } from '../auth/auth.identity';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import { BurnLetterDto, BurnVoiceLetterDto, BurnReceiptDto, BurnReceiptResponseDto, BurnRequestIdDto } from './letters.dto';
import { LettersService } from './letters.service';
import { FriendLettersService } from './friend-letters.service';
import { DeliveryReceiptDto, FriendLetterDto, FriendVoiceLetterDto, validateLetterInput } from './friend-letters.dto';
import { RequestLimit } from '../safety/request-limits';

@ApiTags('letters')
@ApiBearerAuth('clerk-session')
@UseGuards(ClerkAuthGuard)
@ApiUnauthorizedResponse({ description: 'A verified Clerk session is required.' })
@Controller('letters')
@ApiExtraModels(BurnLetterDto, BurnVoiceLetterDto, FriendLetterDto, FriendVoiceLetterDto, WorldTextDto, WorldVoiceDto, BurnReceiptDto, DeliveryReceiptDto, WorldReceiptDto)
export class LettersController {
  constructor(private readonly letters: LettersService, private readonly friends: FriendLettersService, private readonly world: InfinityService) {}

  @Post()
  @RequestLimit('letter-send', 30)
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Confirm a burn, private delivery or public sharing; retries return the original outcome' })
  @ApiBody({ schema: { oneOf: [BurnLetterDto, BurnVoiceLetterDto, FriendLetterDto, FriendVoiceLetterDto, WorldTextDto, WorldVoiceDto].map(type => ({ $ref: getSchemaPath(type) })) } })
  @ApiOkResponse({ schema: { oneOf: [BurnReceiptDto, DeliveryReceiptDto, WorldReceiptDto].map(type => ({ $ref: getSchemaPath(type) })) } })
  @ApiBadRequestResponse({ description: 'Text and voice each require the destination-specific confirmation schema; public letters require an explicit signature choice.' })
  @ApiConflictResponse({ description: 'A profile and companion are required.' })
  @ApiServiceUnavailableResponse({ description: 'Outcome unknown. Keep the same request ID when retrying.' })
  async burn(@CurrentIdentity() identity: AuthIdentity, @Body() body: unknown): Promise<BurnReceipt | DeliveryReceipt | WorldReceipt> {
    const input = validateLetterInput(body);
    return input.destinationType === 'BURNING' ? this.letters.burn(identity.subject, input) : input.destinationType === 'INFINITY' ? this.world.send(identity.subject, input) : this.friends.send(identity.subject, input);
  }

  @Get('burning/requests/:requestId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Check only your own release outcome; never returns letter content' })
  @ApiOkResponse({ type: BurnReceiptResponseDto })
  async receipt(@CurrentIdentity() identity: AuthIdentity, @Param() params: BurnRequestIdDto): Promise<BurnReceiptResponse> {
    return { receipt: await this.letters.receipt(identity.subject, params.requestId) };
  }
}
