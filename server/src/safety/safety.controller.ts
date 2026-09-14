import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { AuthIdentity } from '../auth/auth.identity';
import { SafetyService } from './safety.service';
import { BlockPalaceDto, ReportLetterDto, SafetyIdDto, SafetyListDto } from './safety.dto';
import { RequestLimit } from './request-limits';
@ApiTags('palace safety') @ApiBearerAuth('clerk-session') @UseGuards(ClerkAuthGuard) @Controller('safety')
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}
  @Get('blocks') @Header('Cache-Control', 'no-store') @RequestLimit('safety-read', 60)
  @ApiOperation({ summary: 'Your own closed gates, with pagination; never reveals who blocked you' })
  list(@CurrentIdentity() identity: AuthIdentity, @Query() query: SafetyListDto) { return this.safety.blocked(identity.subject, query.cursor); }
  @Post('blocks/:id') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('safety-action', 30)
  @ApiOperation({ summary: 'Block a palace and end the friendship in both directions; idempotent' })
  block(@CurrentIdentity() identity: AuthIdentity, @Param() params: SafetyIdDto, @Body() _input: BlockPalaceDto) { return this.safety.block(identity.subject, params.id); }
  @Post('blocks/:id/unblock') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('safety-action', 30)
  @ApiOperation({ summary: 'Remove only your block; friendship is not restored automatically' })
  unblock(@CurrentIdentity() identity: AuthIdentity, @Param() params: SafetyIdDto, @Body() _input: BlockPalaceDto) { return this.safety.unblock(identity.subject, params.id); }
  @Post('letters/:id/report') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('letter-report', 10)
  @ApiOperation({ summary: 'Report received private mail or an approved public letter, optionally blocking its author without revealing unsigned identity' })
  report(@CurrentIdentity() identity: AuthIdentity, @Param() params: SafetyIdDto, @Body() input: ReportLetterDto) { return this.safety.report(identity.subject, params.id, input); }
}
