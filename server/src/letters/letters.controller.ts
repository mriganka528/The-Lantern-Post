import { Body, Controller, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiBody, ApiConflictResponse, ApiExtraModels, ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags, ApiUnauthorizedResponse, getSchemaPath } from '@nestjs/swagger';
import type { BurnReceipt, BurnReceiptResponse, DeliveryReceipt } from '@lantern-post/shared-types';
import type { AuthIdentity } from '../auth/auth.identity';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import { BurnLetterDto, BurnReceiptDto, BurnReceiptResponseDto, BurnRequestIdDto } from './letters.dto';
import { LettersService } from './letters.service';
import { FriendLettersService } from './friend-letters.service';
import { DeliveryReceiptDto, FriendLetterDto, validateLetterInput } from './friend-letters.dto';

@ApiTags('letters')
@ApiBearerAuth('clerk-session')
@UseGuards(ClerkAuthGuard)
@ApiUnauthorizedResponse({ description: 'A verified Clerk session is required.' })
@Controller('letters')
@ApiExtraModels(BurnLetterDto, FriendLetterDto, BurnReceiptDto, DeliveryReceiptDto)
export class LettersController {
  constructor(private readonly letters: LettersService, private readonly friends: FriendLettersService) {}

  @Post()
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Confirm a Burning World release or moderated private delivery; retries return the original outcome' })
  @ApiBody({ schema: { oneOf: [{ $ref: getSchemaPath(BurnLetterDto) }, { $ref: getSchemaPath(FriendLetterDto) }] } })
  @ApiOkResponse({ schema: { oneOf: [{ $ref: getSchemaPath(BurnReceiptDto) }, { $ref: getSchemaPath(DeliveryReceiptDto) }] } })
  @ApiBadRequestResponse({ description: 'Only confirmed text letters up to 2,000 Unicode code points for BURNING or FRIEND are supported. Each destination has a strict schema.' })
  @ApiConflictResponse({ description: 'A profile and companion are required.' })
  @ApiServiceUnavailableResponse({ description: 'Outcome unknown. Keep the same request ID when retrying.' })
  async burn(@CurrentIdentity() identity: AuthIdentity, @Body() body: unknown): Promise<BurnReceipt | DeliveryReceipt> {
    const input = validateLetterInput(body);
    return input.destinationType === 'BURNING' ? this.letters.burn(identity.subject, input) : this.friends.send(identity.subject, input);
  }

  @Get('burning/requests/:requestId')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Check only your own release outcome; never returns letter content' })
  @ApiOkResponse({ type: BurnReceiptResponseDto })
  async receipt(@CurrentIdentity() identity: AuthIdentity, @Param() params: BurnRequestIdDto): Promise<BurnReceiptResponse> {
    return { receipt: await this.letters.receipt(identity.subject, params.requestId) };
  }
}
