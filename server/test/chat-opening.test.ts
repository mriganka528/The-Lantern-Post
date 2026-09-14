import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import type { ChatPage, ChatReceipt } from '@lantern-post/shared-types';
import { createFriendsTestApp } from './friends-fixture';
import { PrismaService } from '../src/database/prisma.service';
import { consumeRequestWindow } from '../src/safety/request-limits';

let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
before(async () => { context = await createFriendsTestApp(false, undefined, undefined, 'disabled'); });
beforeEach(() => { context.fixture.reset(); context.fixture.state.requests.push({ id: 'friendship', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date() }); });
after(async () => { await context.app.close(); });
const request = (path: string, body?: unknown) => fetch(context.url + path, { method: body ? 'POST' : 'GET', headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
const send = () => request('/chat/owner-bob/messages', { requestId: randomUUID(), text: 'Synthetic opening message.', confirmed: true });
async function until(test: () => boolean) { const deadline = Date.now() + 5000; while (!test()) { if (Date.now() > deadline) throw Error('Socket response did not arrive'); await new Promise(resolve => setTimeout(resolve, 10)); } }
async function open() {
  const ws = new WebSocket(context.url.replace('http:', 'ws:') + '/chat/socket');
  const frames: { type: string; page?: ChatPage; reason?: string }[] = [];
  ws.on('message', raw => frames.push(JSON.parse(String(raw))));
  await new Promise<void>((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });
  ws.send(JSON.stringify({ type: 'subscribe', token: 'alice', peerId: 'owner-bob', after: null }));
  await until(() => frames.length > 0); return { ws, frames };
}
test('the opening socket returns the latest thirty messages and then continues from their cursor', async () => {
  assert.equal((await send()).status, 200); const first = context.fixture.state.chatMessages[0]!;
  for (let sequence = 2; sequence <= 80; sequence++) context.fixture.state.chatMessages.push({ ...first, id: 'chatmsg_' + randomUUID(), sequence });
  context.fixture.state.chatThreads[0]!.nextSequence = 80;
  const { ws, frames } = await open();
  try {
    const page = frames[0]!.page!; assert.equal(page.messages.length, 30); assert.equal(page.messages[0]?.sequence, 51); assert.equal(page.cursor, 80); assert.equal(page.before, 51); assert.equal(page.capabilities?.textAvailable, true);
    const next = await (await send()).json() as ChatReceipt; assert.equal(next.sequence, 81);
    await until(() => frames.some(frame => frame.page?.messages.some(message => message.sequence === 81)));
    const older = await (await request('/chat/owner-bob?before=51')).json() as ChatPage; assert.equal(older.messages.length, 50); assert.equal(older.messages[0]?.sequence, 1);
    assert.ok(!JSON.stringify(frames).includes('must-not-leak'));
  } finally { ws.close(); }
});
test('opening through the socket preserves closed-gate checks and the HTTP history budget', async () => {
  context.fixture.state.requests = [];
  const blocked = await open(); assert.equal(blocked.frames[0]?.type, 'closed'); assert.equal(blocked.frames[0]?.page, undefined); blocked.ws.close();
  context.fixture.state.requests.push({ id: 'friendship', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date() });
  const prisma = context.app.get(PrismaService);
  await prisma.$transaction(tx => consumeRequestWindow(tx, String(context.fixture.state.users[0]!.authProviderId), { scope: 'chat-history', maximum: 60, milliseconds: 60000 }, Date.now(), 59));
  const limited = await open(); assert.equal(limited.frames[0]?.type, 'error'); assert.equal(limited.frames[0]?.reason, 'throttled'); assert.equal(limited.frames[0]?.page, undefined); limited.ws.close();
  assert.equal((await request('/chat/owner-bob')).status, 429);
});
test('a friendship closed after the opening packet ends the stream', async () => {
  await send(); const { ws, frames } = await open();
  try {
    assert.equal(frames[0]?.type, 'page');
    assert.equal((await request('/safety/blocks/owner-bob', { confirmed: true })).status, 200);
    await until(() => frames.some(frame => frame.type === 'closed'));
  } finally { ws.close(); }
});
