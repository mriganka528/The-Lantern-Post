import { Injectable } from '@nestjs/common';
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { Socket } from 'node:net';
import WebSocket from 'ws';
import { ClerkTokenVerifier } from '../auth/clerk-token-verifier.service';
import { AccountAccess } from '../account/account-access';
import type { Environment } from '../config/environment';
import { ChatService } from './chat.service';
import { PrismaService } from '../database/prisma.service';
import { PalaceEvents } from '../realtime/palace-events';
import { RequestLimits } from '../safety/request-limits';

@Injectable()
export class ChatSocket implements OnApplicationBootstrap, OnModuleDestroy {
  private server = new WebSocket.Server({ noServer: true, maxPayload: 16384, perMessageDeflate: false });
  private http: Server | undefined; private counts = new Map<string, number>(); private pending = 0;
  constructor(private adapter: HttpAdapterHost, private config: ConfigService<Environment, true>, private tokens: ClerkTokenVerifier, private accounts: AccountAccess, private chat: ChatService, private prisma: PrismaService,private events:PalaceEvents,private limits:RequestLimits) {}
  private upgrade = (request: IncomingMessage, socket: Duplex, head: Buffer) => {
    if (request.url !== '/chat/socket'&&request.url!=='/events/socket') { socket.destroy(); return; }
    const origin = request.headers.origin;
    const allowed = !origin || this.config.get('WEB_ORIGINS').includes(origin) || this.config.get('NODE_ENV') === 'test' && origin === 'null';
    if (!allowed || this.pending >= 64) { socket.destroy(); return; }
    if (!(socket instanceof Socket)) { socket.destroy(); return; }
    this.server.handleUpgrade(request, socket, head, client => { void this.connect(client,request.url==='/events/socket'); });
  };
  onApplicationBootstrap() { this.http = this.adapter.httpAdapter.getHttpServer() as Server; this.http.on('upgrade', this.upgrade); }
  onModuleDestroy() { this.http?.removeListener('upgrade', this.upgrade); this.server.clients.forEach(client => client.terminate()); this.server.close(); }
  private async connect(socket: WebSocket,feed=false) {
    this.pending++; let ownerId: string | undefined; let subscribed = false; const abort = new AbortController(); let lease: ReturnType<typeof setTimeout> | undefined;
    const authTimeout = setTimeout(() => socket.close(4001, 'Sign in again'), 5000);
    let pong = true; const heartbeat = setInterval(() => { if (!pong) { socket.terminate(); return; } pong = false; socket.ping(); }, 20000);
    socket.on('pong', () => { pong = true; }); socket.on('error', () => socket.close());
    let frames = 0; socket.on('message', () => { if (++frames > 1) socket.close(1008, 'Unexpected message'); });
    socket.once('close', () => { abort.abort(); clearTimeout(authTimeout); clearTimeout(lease); clearInterval(heartbeat); if (!subscribed) this.pending--; if (ownerId) { const count = (this.counts.get(ownerId) ?? 1) - 1; if (count) this.counts.set(ownerId, count); else this.counts.delete(ownerId); } });
    socket.once('message', async raw => {
      try {
        const text = typeof raw === 'string' ? raw : Buffer.isBuffer(raw) ? raw.toString('utf8') : '';
        const input: unknown = JSON.parse(text);
        if (!input || typeof input !== 'object') throw Error(); const data = input as Record<string, unknown>;
        if (Object.keys(data).sort().join(',') !== (feed?'after,token,type':'after,peerId,token,type') || data.type !== 'subscribe' || typeof data.token !== 'string' || data.token.length > 12000 || (!feed&&(typeof data.peerId !== 'string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(data.peerId))) || data.after!==null && (!Number.isInteger(data.after)||Number(data.after)<0||Number(data.after)>2147483647)) throw Error();
        const identity = await this.tokens.verify(data.token);
        const [, owner] = await Promise.all([this.accounts.assertSubject(identity.subject), this.prisma.user.findUnique({ where: { authProviderId: identity.subject, accountState: 'ACTIVE' }, select: { id: true, characterId: true } })]);
        if (!owner || abort.signal.aborted || (this.counts.get(owner.id) ?? 0) >= 6) throw Error();
        const lifetime = Math.min(45000, (identity.expiresAt ?? Date.now() + 45000) - Date.now()); if (lifetime <= 0) throw Error();
        ownerId = owner.id; this.counts.set(owner.id, (this.counts.get(owner.id) ?? 0) + 1); subscribed = true; this.pending--; clearTimeout(authTimeout);
        lease = setTimeout(() => socket.close(4001, 'Refresh session'), lifetime);
        if(feed){let cursor=data.after as number|null;let first=true;let last=0;
          while(!abort.signal.aborted&&socket.readyState===WebSocket.OPEN){const version=this.events.version(owner.id);const page=await this.events.read(owner.id,cursor);if(abort.signal.aborted)return;if(first||page.events.length||Date.now()-last>10000){if(socket.bufferedAmount>1000000){socket.close(1013,'Reconnect');return;}socket.send(JSON.stringify({type:'events',page}));cursor=page.cursor;first=false;last=Date.now();}if(page.events.length===50)continue;await this.events.wait(owner.id,version,abort.signal);}return;
        }
        if (!owner.characterId) { socket.send(JSON.stringify({ type: 'closed' })); socket.close(4003, 'Gate closed'); return; }
        // Null requests recent history and live updates in one authenticated
        // connection. Keep the same durable budget as the HTTP history route.
        if (data.after === null) await this.limits.consume(identity.subject, { scope: 'chat-history', maximum: 60, milliseconds: 60000 });
        const peerId=data.peerId as string;let cursor = data.after === null ? null : Number(data.after); let first = true; let last = 0;
        while (!abort.signal.aborted && socket.readyState === WebSocket.OPEN) {
          // Every page rechecks active accounts, accepted friendship and both
          // block directions. The socket never accepts send commands.
          const opening = cursor === null;
          const version=this.events.version(owner.id);const page = await this.chat.streamHistory(owner.id, peerId, undefined, cursor ?? undefined, opening ? 30 : 50);
          if (abort.signal.aborted) return;
          if (first || page.messages.length || Date.now() - last > 10000) {
            if (socket.bufferedAmount > 1_000_000) { socket.close(1013, 'Reconnect'); return; }
            socket.send(JSON.stringify({ type: 'page', page })); cursor = Math.max(cursor ?? 0, page.cursor); first = false; last = Date.now();
          }
          if (page.messages.length === 50) continue;
          await this.events.wait(owner.id,version,abort.signal);
        }
      } catch (error) {
        if (!abort.signal.aborted && socket.readyState === WebSocket.OPEN) {
          const status = error && typeof error === 'object' && 'getStatus' in error && typeof error.getStatus === 'function' ? error.getStatus() as number : 0;
          const closed = [404, 409, 410].includes(status);
          socket.send(JSON.stringify({ type: closed ? 'closed' : 'error', ...(!closed && status === 429 ? { reason: 'throttled' } : {}) })); socket.close(closed ? 4003 : 4001, closed ? 'Gate closed' : 'Reconnect');
        }
      }
    });
  }
}
