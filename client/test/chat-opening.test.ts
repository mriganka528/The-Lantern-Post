import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { setImmediate } from 'node:timers/promises';
import type { ChatPage } from '@lantern-post/shared-types';
import type { SocketPort } from '../src/chat/chat-socket';
import { ChatFault } from '../src/chat/chat-contract';

let createChatTransport: typeof import('../src/chat/chat-api').createChatTransport;
const oldFetch = globalThis.fetch; const oldUrl = process.env.EXPO_PUBLIC_API_URL; const oldKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const oldDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
before(async () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.invalid'; process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk'; Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  ({ createChatTransport } = await import('../src/chat/chat-api'));
});
afterEach(() => { globalThis.fetch = oldFetch; });
after(() => {
  if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = oldUrl;
  if (oldKey === undefined) delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = oldKey;
  if (oldDev) Object.defineProperty(globalThis, '__DEV__', oldDev); else Reflect.deleteProperty(globalThis, '__DEV__');
});
const page = (cursor = 0): ChatPage => ({ peer: { id: 'bob', username: 'bob', character: null }, messages: [], cursor, before: null, capabilities: { textAvailable: true } });
function socket(): SocketPort & { frames: string[]; closed: boolean } {
  return { readyState: 1, onopen: null, onclose: null, onerror: null, onmessage: null, frames: [], closed: false, send(value) { this.frames.push(value); }, close() { this.closed = true; } };
}
test('one socket supplies opening history, availability and subsequent pages without HTTP startup calls', async () => {
  const port = socket(); const abort = new AbortController(); let sockets = 0;
  globalThis.fetch = async () => { throw Error('Opening should not use HTTP'); };
  const api = createChatTransport(async options => { assert.ok(!options?.skipCache); return 'session-token'; }, () => { sockets++; return port; });
  const opening = api.open!('bob', abort.signal); await setImmediate(); port.onopen?.();
  assert.deepEqual(JSON.parse(port.frames[0]!), { type: 'subscribe', token: 'session-token', peerId: 'bob', after: null });
  port.onmessage?.({ data: JSON.stringify({ type: 'page', page: page(70) }) }); assert.equal((await opening).cursor, 70);
  const next = api.poll('bob', 70, abort.signal); port.onmessage?.({ data: JSON.stringify({ type: 'page', page: page(71) }) });
  assert.equal((await next).cursor, 71); assert.equal(sockets, 1); abort.abort(); assert.equal(port.closed, true);
});
test('a blocked socket falls back to HTTP history and polling without a reconnect loop', async () => {
  const abort = new AbortController(); const calls: string[] = []; let sockets = 0;
  globalThis.fetch = async url => { calls.push(String(url)); return Response.json(page(calls.length)); };
  const api = createChatTransport(async () => 'token', () => { sockets++; throw Error('Upgrade blocked'); });
  assert.equal((await api.open!('bob', abort.signal)).cursor, 1); assert.equal((await api.poll('bob', 1, abort.signal)).cursor, 2);
  assert.deepEqual(calls, ['https://api.example.invalid/chat/bob', 'https://api.example.invalid/chat/bob/poll?after=1']); assert.equal(sockets, 1); abort.abort();
});
test('socket success cancels a slower fallback and ignores its late response', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const port = socket(); const abort = new AbortController();
  let requestSignal: AbortSignal | null | undefined; let finish!: (response: Response) => void;
  globalThis.fetch = async (_url, options) => { requestSignal = options?.signal; return new Promise(resolve => { finish = resolve; }); };
  const api = createChatTransport(async () => 'token', () => port);
  const opening = api.open!('bob', abort.signal); await setImmediate(); t.mock.timers.tick(1200); await setImmediate();
  port.onmessage?.({ data: JSON.stringify({ type: 'page', page: page(5) }) }); assert.equal((await opening).cursor, 5); assert.equal(requestSignal?.aborted, true);
  finish(Response.json(page(2))); await setImmediate(); assert.equal(port.closed, false); abort.abort();
});
test('closed gates and throttling cannot be bypassed through the HTTP fallback', async () => {
  for (const kind of ['closed', 'throttled'] as const) {
    let http = 0; globalThis.fetch = async () => { http++; return Response.json(page()); };
    const port = socket(); const abort = new AbortController(); const api = createChatTransport(async () => 'token', () => port);
    const opening = api.open!('bob', abort.signal); const rejected = assert.rejects(opening, (error: unknown) => error instanceof ChatFault && error.kind === kind);
    await setImmediate(); port.onmessage?.({ data: JSON.stringify(kind === 'closed' ? { type: 'closed' } : { type: 'error', reason: 'throttled' }) });
    await rejected; assert.equal(http, 0); abort.abort();
  }
});
test('leaving during authentication cancels both opening paths and prevents late connections', async () => {
  let resolveToken!: (token: string) => void; let sockets = 0, http = 0;
  globalThis.fetch = async () => { http++; return Response.json(page()); };
  const api = createChatTransport(() => new Promise(resolve => { resolveToken = resolve; }), () => { sockets++; return socket(); }); const abort = new AbortController();
  const opening = api.open!('bob', abort.signal); const rejected = assert.rejects(opening); abort.abort(); await rejected;
  resolveToken('late-token'); await setImmediate(); assert.equal(sockets, 0); assert.equal(http, 0);
});
