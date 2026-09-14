import { Body, Controller, Header, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { readVoiceUpload } from './voice-upload-body';
import { ApiBearerAuth, ApiBody, ApiExtraModels, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import type { AuthIdentity } from '../auth/auth.identity';
import { VoiceAssetIdDto, VoiceUploadDto, WorldVoiceUploadDto, validateVoiceUpload } from './voice.dto';
import { VoiceAssetsService } from './voice-assets.service';
import { RequestLimit } from '../safety/request-limits';
@ApiTags('voice letters') @ApiBearerAuth('clerk-session') @UseGuards(ClerkAuthGuard) @Controller('voice/uploads')
export class VoiceController {
  constructor(private readonly voice: VoiceAssetsService) {}
  @Post() @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Reserve a bounded voice upload bound to your friend or Infinity World delivery' })
  @RequestLimit('voice-reserve', 20)
  @ApiExtraModels(VoiceUploadDto, WorldVoiceUploadDto)
  @ApiBody({ schema: { oneOf: [VoiceUploadDto, WorldVoiceUploadDto].map(type => ({ $ref: getSchemaPath(type) })) } })
  create(@CurrentIdentity() identity: AuthIdentity, @Body() input: unknown) { return this.voice.create(identity.subject, validateVoiceUpload(input)); }
  @Post(':id/content') @HttpCode(200) @Header('Cache-Control','no-store') @RequestLimit('voice-content',20)
  @ApiOperation({summary:'Upload recording bytes through the authenticated API into private storage'})
  async content(@CurrentIdentity() identity:AuthIdentity,@Param() params:VoiceAssetIdDto,@Req() request:IncomingMessage) {
    const ticket=await this.voice.proxyUploadTicket(identity.subject,params.id);
    const bytes=await readVoiceUpload(request,ticket.byteLength,ticket.mimeType);
    return this.voice.receiveProxyUpload(identity.subject,params.id,bytes,ticket);
  }
  @Post(':id/finish') @HttpCode(200) @Header('Cache-Control', 'no-store') @ApiOperation({ summary: 'Validate actual audio bytes and promote them to an immutable private object' })
  @RequestLimit('voice-check', 20)
  finish(@CurrentIdentity() identity: AuthIdentity, @Param() params: VoiceAssetIdDto) { return this.voice.finish(identity.subject, params.id); }
}
