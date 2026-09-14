import { Body, Controller, Get, Header, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { AuthIdentity } from '../auth/auth.identity';
import { RequestLimit } from '../safety/request-limits';
import { DiagnosticsPreferencesDto, validateDiagnostic } from './diagnostics.dto';
import { DiagnosticsService } from './diagnostics.service';
@ApiTags('optional diagnostics') @ApiBearerAuth('clerk-session') @UseGuards(ClerkAuthGuard) @Controller('diagnostics')
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}
  @Get('preferences') @Header('Cache-Control', 'no-store')
  get(@CurrentIdentity() identity: AuthIdentity) { return this.diagnostics.preferences(identity.subject); }
  @Post('preferences') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('diagnostics-preference', 20)
  set(@CurrentIdentity() identity: AuthIdentity, @Body() input: DiagnosticsPreferencesDto) { return this.diagnostics.configure(identity.subject, input.enabled); }
  @Post('events') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('diagnostics-events', 30)
  @ApiOperation({ summary: 'Opt-in fixed usage/error codes only; rejects arbitrary content or identities' })
  event(@CurrentIdentity() identity: AuthIdentity, @Body() input: unknown) { return this.diagnostics.record(identity.subject, validateDiagnostic(input)); }
}
