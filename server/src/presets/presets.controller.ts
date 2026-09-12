import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import type { PresetsResponse } from '@lantern-post/shared-types';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { PresetsResponseDto } from './presets.dto';
import { PresetsService } from './presets.service';

@ApiTags('stationery')
@ApiBearerAuth('clerk-session')
@ApiUnauthorizedResponse({ description: 'A verified Clerk session is required.' })
@UseGuards(ClerkAuthGuard)
@Controller('presets')
export class PresetsController {
  constructor(private readonly presets: PresetsService) {}

  @Get()
  @ApiOperation({ summary: 'List available letter stationery; no letter content is received or stored' })
  @ApiOkResponse({ type: PresetsResponseDto })
  async list(): Promise<PresetsResponse> { return { presets: await this.presets.list() }; }
}
