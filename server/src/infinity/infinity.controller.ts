import { Body, Controller, Get, Header, HttpCode, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { AuthIdentity } from '../auth/auth.identity';
import { RequestLimit } from '../safety/request-limits';
import { BlockPalaceDto, SafetyIdDto } from '../safety/safety.dto';
import { SafetyService } from '../safety/safety.service';
import { BurnRequestIdDto } from '../letters/letters.dto';
import { WorldBoundsDto, WorldCancelDto, WorldCursorDto } from './infinity.dto';
import { InfinityService } from './infinity.service';
@ApiTags('infinity world') @ApiBearerAuth('clerk-session') @UseGuards(ClerkAuthGuard) @Controller('infinity')
export class InfinityController {
  constructor(private readonly world: InfinityService, private readonly safety: SafetyService) {}
  @Get('capabilities') @Header('Cache-Control', 'no-store')
  capabilities() { return this.world.capabilities(); }
  @Get('stars') @Header('Cache-Control', 'no-store') @RequestLimit('world-view', 120)
  @ApiOperation({ summary: 'Delivered public star markers within a bounded viewport; no authors or content' })
  list(@CurrentIdentity() identity: AuthIdentity, @Query() query: WorldBoundsDto) { return this.world.list(identity.subject, query, query.cursor); }
  @Get('mine') @Header('Cache-Control', 'no-store') @RequestLimit('world-view', 120)
  mine(@CurrentIdentity() identity: AuthIdentity, @Query() query: WorldCursorDto) { return this.world.list(identity.subject, null, query.cursor); }
  @Get('requests/:requestId') @Header('Cache-Control', 'no-store')
  async status(@CurrentIdentity() identity: AuthIdentity, @Param() params: BurnRequestIdDto) { return { receipt: await this.world.status(identity.subject, params.requestId) }; }
  @Post('requests/:requestId/cancel') @HttpCode(200) @Header('Cache-Control', 'no-store')
  cancel(@CurrentIdentity() identity: AuthIdentity, @Param() params: BurnRequestIdDto, @Body() input: WorldCancelDto) { return this.world.cancel(identity.subject, params.requestId, input.isSigned); }
  @Post('stars/:id/open') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('world-open', 60)
  @ApiOperation({ summary: 'Open delivered public text/voice; serialize username only for explicitly signed letters' })
  open(@CurrentIdentity() identity: AuthIdentity, @Param() params: SafetyIdDto) { return this.world.open(identity.subject, params.id); }
  @Post('stars/:id/delete') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('world-delete', 30)
  remove(@CurrentIdentity() identity: AuthIdentity, @Param() params: SafetyIdDto, @Body() _input: BlockPalaceDto) { return this.world.remove(identity.subject, params.id); }
  @Post('stars/:id/block') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('safety-action', 30)
  block(@CurrentIdentity() identity: AuthIdentity, @Param() params: SafetyIdDto, @Body() _input: BlockPalaceDto) { return this.safety.blockPublic(identity.subject, params.id); }
}
