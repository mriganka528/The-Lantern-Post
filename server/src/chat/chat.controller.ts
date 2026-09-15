import { BadRequestException, Body, Controller, Get, Header, HttpCode, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthIdentity } from '../auth/auth.identity';
import { ClerkAuthGuard } from '../auth/clerk-auth.guard';
import { CurrentIdentity } from '../auth/current-identity.decorator';
import { RequestLimit } from '../safety/request-limits';
import { ChatConfirmDto, ChatHistoryDto, ChatMessageDto, ChatPeerDto, ChatPollDto, ChatRemoveDto, ChatReportDto, ChatRequestDto, ChatSendDto, ChatSyncDto } from './chat.dto';
import { ChatService } from './chat.service';

@Controller('chat') @ApiTags('friend-chat') @ApiBearerAuth('clerk-session') @UseGuards(ClerkAuthGuard)
export class ChatController {
  constructor(private readonly chat: ChatService) {}
  @Get('capabilities') @Header('Cache-Control', 'no-store')
  capabilities() { return this.chat.capabilities(); }
  @Post(':peerId/sync') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('chat-sync', 60)
  sync(@CurrentIdentity() owner: AuthIdentity, @Param() peer: ChatPeerDto, @Body() input: ChatSyncDto) { return this.chat.sync(owner.subject, peer.peerId, input.ids); }
  @Post('messages/:messageId/remove') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('chat-remove', 60)
  remove(@CurrentIdentity() owner: AuthIdentity, @Param() query: ChatMessageDto, @Body() input: ChatRemoveDto) { return this.chat.remove(owner.subject, query.messageId, input.scope); }
  @Get(':peerId') @Header('Cache-Control', 'no-store') @RequestLimit('chat-history', 60)
  history(@CurrentIdentity() owner: AuthIdentity, @Param() peer: ChatPeerDto, @Query() query: ChatHistoryDto) {
    if (query.before !== undefined && query.after !== undefined) throw new BadRequestException('Choose one history direction.');
    return this.chat.history(owner.subject, peer.peerId, query.before, query.after);
  }
  @Get(':peerId/poll') @Header('Cache-Control', 'no-store') @RequestLimit('chat-poll', 180)
  async poll(@CurrentIdentity() owner: AuthIdentity, @Param() peer: ChatPeerDto, @Query() query: ChatPollDto, @Req() request: IncomingMessage, @Res({ passthrough: true }) response: ServerResponse) {
    const abort = new AbortController(); const close = () => abort.abort(); request.once('aborted', close); response.once('close', close);
    try { return await this.chat.poll(owner.subject, peer.peerId, query.after, abort.signal); }
    finally { request.removeListener('aborted', close); response.removeListener('close', close); }
  }
  @Post(':peerId/messages') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('chat-send', 30)
  send(@CurrentIdentity() owner: AuthIdentity, @Param() peer: ChatPeerDto, @Body() body: ChatSendDto) { return this.chat.send(owner.subject, peer.peerId, body); }
  @Get(':peerId/requests/:requestId') @Header('Cache-Control', 'no-store') @RequestLimit('chat-receipt', 240)
  async status(@CurrentIdentity() owner: AuthIdentity, @Param() query: ChatRequestDto) { return { receipt: await this.chat.status(owner.subject, query.peerId, query.requestId) }; }
  @Post(':peerId/requests/:requestId/cancel') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('chat-cancel', 60)
  cancel(@CurrentIdentity() owner: AuthIdentity, @Param() query: ChatRequestDto, @Body() _body: ChatConfirmDto) { return this.chat.cancel(owner.subject, query.peerId, query.requestId); }
  @Post('messages/:messageId/report') @HttpCode(200) @Header('Cache-Control', 'no-store') @RequestLimit('chat-report', 15)
  report(@CurrentIdentity() owner: AuthIdentity, @Param() query: ChatMessageDto, @Body() body: ChatReportDto) { return this.chat.report(owner.subject, query.messageId, body); }
}
