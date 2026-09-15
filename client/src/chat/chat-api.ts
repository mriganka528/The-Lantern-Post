import type { ChatCapabilities, ChatReceipt, LetterReportReceipt } from '@lantern-post/shared-types';
import { apiRequest, ApiError } from '../api/client';
import type { GetSessionToken } from '../api/client';
import { ChatFault, readChatPage, readChatReceipt } from './chat-contract';
import type { ChatTransport } from './chat-contract';
import { env } from '../config/env';
import { ChatSocketChannel } from './chat-socket';
import type { SocketPort } from './chat-socket';
export function createChatTransport(token: GetSessionToken, socketFactory: (url: string) => SocketPort = url => new WebSocket(url) as unknown as SocketPort): ChatTransport {
  let channel: ChatSocketChannel | null = null; let subscription: AbortSignal | undefined; let target: string | null = null;
  let httpMode = false;
  async function run<T>(work: () => Promise<T>): Promise<T> { try { return await work(); } catch (error) { if (error instanceof ApiError) throw new ChatFault(error.status === 404 || error.status === 403 || error.status === 410 || error.code === 'PROFILE_REQUIRED' ? 'closed' : error.status === 401 ? 'session' : error.status === 429 ? 'throttled' : error.code === 'MODERATION_UNAVAILABLE' ? 'moderation' : 'connection'); throw error; } }
  const root = (peer: string) => '/chat/' + encodeURIComponent(peer);
  const history: ChatTransport['history'] = (peer, before, signal) => run(async () => readChatPage(await apiRequest(root(peer) + (before ? '?before=' + before : ''), token, { signal }), peer));
  function stream(peer: string, after: number | null, signal: AbortSignal) {
    channel?.close(); const url = new URL(env.apiUrl); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.pathname = url.pathname.replace(/\/$/, '') + '/chat/socket'; url.search = ''; url.hash = '';
    const next = new ChatSocketChannel(peer, after, url.toString(), () => token(), socketFactory, signal); channel = next; subscription = signal; target = peer;
    void next.start().catch(() => next.close()); return next;
  }
  return {
    open: (peer, signal, after) => run(() => {
      if (signal.aborted) throw new ChatFault('connection');
      httpMode = false; const next = stream(peer, after ?? null, signal);
      // Usually the first socket frame supplies both recent history and send
      // availability. A slow/blocked upgrade can fall back to the HTTP reader.
      return new Promise((resolve, reject) => {
        let settled = false, startedHttp = false, socketFailed = false;
        let httpFailure: unknown; const http = new AbortController();
        const fatal = (error: unknown) => error instanceof ChatFault && ['closed', 'session', 'throttled'].includes(error.kind);
        const cleanup = () => { clearTimeout(timer); signal.removeEventListener('abort', cancel); };
        const fail = (error: unknown) => { if (settled) return; settled = true; cleanup(); http.abort(); next.close(); reject(error); };
        const finish = (page: ReturnType<typeof readChatPage>, useHttp: boolean) => {
          if (settled) return;
          if (signal.aborted || subscription !== signal || target !== peer || channel !== next) { fail(new ChatFault('connection')); return; }
          settled = true; cleanup(); httpMode = useHttp;
          if (useHttp) next.close(); else http.abort();
          resolve(page);
        };
        const fallback = () => {
          if (settled || startedHttp) return; startedHttp = true;
          const read = after === undefined ? history(peer, undefined, http.signal) : run(async () => readChatPage(await apiRequest(root(peer) + '?after=' + after, token, { signal: http.signal }), peer));
          void read.then(page => finish(page, true)).catch(error => { httpFailure = error; if (socketFailed || fatal(error)) fail(error); });
        };
        const cancel = () => fail(new ChatFault('connection'));
        const timer = setTimeout(fallback, 1200);
        signal.addEventListener('abort', cancel, { once: true });
        if (signal.aborted) { cancel(); return; }
        void next.next().then(page => finish(page, false)).catch(error => { socketFailed = true; if (fatal(error)) fail(error); else if (httpFailure) fail(httpFailure); else fallback(); });
      });
    }),
    capabilities: signal => run(async () => { const result = await apiRequest<ChatCapabilities>('/chat/capabilities', token, { signal }); if (typeof result.textAvailable !== 'boolean') throw new ChatFault('connection'); return result; }),
    history,
    sync: (peer, ids, signal) => run(async () => {
      const page = readChatPage(await apiRequest(root(peer) + '/sync', token, { method: 'POST', body: { ids }, signal }), peer, 200);
      if (page.messages.some(message => !ids.includes(message.id))) throw new ChatFault('connection');
      return page.messages;
    }),
    remove: (messageId, scope, signal) => run(async () => {
      const result = await apiRequest<{ messageId: string; scope: string; removed: boolean }>('/chat/messages/' + encodeURIComponent(messageId) + '/remove', token, { method: 'POST', body: { scope, confirmed: true }, signal });
      if (result.messageId !== messageId || result.scope !== scope || result.removed !== true) throw new ChatFault('connection');
    }),
    poll: (peer, after, signal) => run(async () => {
      if (!signal || signal.aborted) throw new ChatFault('connection');
      if (httpMode && subscription === signal && target === peer) return readChatPage(await apiRequest(root(peer) + '/poll?after=' + after, token, { signal }), peer);
      if (!channel || channel.closed || subscription !== signal || target !== peer) {
        stream(peer, after, signal);
      }
      return channel!.next();
    }),
    send: (peer, input, signal) => run(async () => readChatReceipt(await apiRequest(root(peer) + '/messages', token, { method: 'POST', body: input, signal }), input.requestId, peer)),
    receipt: (peer, requestId, signal) => run(async () => { const result = await apiRequest<{ receipt: ChatReceipt | null }>(root(peer) + '/requests/' + requestId, token, { signal }); return result.receipt ? readChatReceipt(result.receipt, requestId, peer) : null; }),
    cancel: (peer, requestId, signal) => run(async () => readChatReceipt(await apiRequest(root(peer) + '/requests/' + requestId + '/cancel', token, { method: 'POST', body: { confirmed: true }, signal }), requestId, peer)),
    report: (id, input) => apiRequest<LetterReportReceipt>('/chat/messages/' + encodeURIComponent(id) + '/report', token, { method: 'POST', body: input }),
  };
}
