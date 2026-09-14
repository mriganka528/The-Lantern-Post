import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { ServiceUnavailableException } from '@nestjs/common';
import type { ChatPage, ChatReceipt, ChatSendRequest } from '@lantern-post/shared-types';
import { createFriendsTestApp } from './friends-fixture';
let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
let mode: 'approve' | 'reject' | 'hold' | 'offline' = 'approve'; let entered = () => {}; let release = () => {};
const check = async () => { entered(); if (mode === 'hold') await new Promise<void>(resolve => { release = resolve; }); if (mode === 'offline') throw new ServiceUnavailableException(); return mode === 'reject' ? 'REJECTED' as const : 'APPROVED' as const; };
before(async () => { context = await createFriendsTestApp(false, { available: true, check }); });
beforeEach(() => { context.fixture.reset(); mode = 'approve'; entered = () => {}; release = () => {}; context.fixture.state.requests.push({ id: 'accepted', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', respondedAt: new Date(), createdAt: new Date() }); });
after(async () => context?.app.close());
const input = (text = 'A synthetic hello beneath the roses.'): ChatSendRequest => ({ requestId: randomUUID(), text, confirmed: true });
const request = (path: string, who = 'alice', body?: unknown, method = body ? 'POST' : 'GET', signal?: AbortSignal) => fetch(context.url + path, { method, signal, headers: { ...(who ? { Authorization: 'Bearer ' + who } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
const send = (body = input(), who = 'alice', peer = 'owner-bob') => request(`/chat/${peer}/messages`, who, body);

test('chat authenticates first and accepts only bounded explicit send intent', async () => {
  for (const path of ['/chat/capabilities', '/chat/owner-bob', '/chat/owner-bob/poll?after=0']) assert.equal((await request(path, '')).status, 401);
  assert.equal(context.fixture.state.calls, 0);
  for (const body of [{ ...input(), confirmed: false }, { ...input(), senderId: 'owner-bob' }, { ...input(), moderationPassed: true }, { ...input(), text: '' }, { ...input(), text: 'x'.repeat(2001) }, { ...input(), requestId: 'not-a-uuid' }]) assert.equal((await send(body as ChatSendRequest)).status, 400);
  assert.equal(context.fixture.state.chatMessages.length, 0);
});
test('only mutually accepted, unblocked friends may read or receive chat', async () => {
  for (const peer of ['owner-carol', 'owner-bert', 'owner-alice', 'missing']) assert.equal((await request('/chat/' + peer)).status, 404);
  assert.equal((await (await send(input(), 'alice', 'owner-carol')).json() as ChatReceipt).reason, 'FRIEND_UNAVAILABLE');
  context.fixture.state.requests[0]!.status = 'PENDING'; assert.equal((await request('/chat/owner-bob')).status, 404);
  context.fixture.state.requests[0]!.status = 'ACCEPTED'; context.fixture.state.blocks.push({ id: 'reverse', blockerId: 'owner-bob', blockedId: 'owner-alice' }); assert.equal((await request('/chat/owner-bob')).status, 404); assert.equal((await send()).status, 200); assert.equal(context.fixture.state.chatMessages.length, 0);
});
test('required mode fails closed and held approval exposes no message before the decision', async () => {
  const isolated = await createFriendsTestApp();
  try { isolated.fixture.state.requests.push({ ...context.fixture.state.requests[0] }); const response = await fetch(isolated.url + '/chat/owner-bob/messages', { method: 'POST', headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' }, body: JSON.stringify(input()) }); assert.equal(response.status, 503); assert.equal(isolated.fixture.state.chatMessages.length, 0); assert.deepEqual(await (await fetch(isolated.url + '/chat/capabilities', { headers: { Authorization: 'Bearer alice' } })).json(), { textAvailable: false }); } finally { await isolated.app.close(); }
  mode = 'hold'; const reached = new Promise<void>(resolve => { entered = resolve; }); const pending = send(); await reached; assert.equal(context.fixture.state.chatMessages.length, 0); assert.deepEqual((await (await request('/chat/owner-alice', 'bob')).json() as ChatPage).messages, []); release(); assert.equal((await (await pending).json() as ChatReceipt).outcome, 'DELIVERED');
});
test('approval is rechecked against a block before commit and unblocking never resumes friendship', async () => {
  mode = 'hold'; const reached = new Promise<void>(resolve => { entered = resolve; }); const pending = send(); await reached;
  await request('/safety/blocks/owner-alice', 'bob', { confirmed: true }); release(); assert.equal((await (await pending).json() as ChatReceipt).reason, 'FRIEND_UNAVAILABLE'); assert.equal(context.fixture.state.chatMessages.length, 0);
  await request('/safety/blocks/owner-alice/unblock', 'bob', { confirmed: true }); assert.equal((await request('/chat/owner-bob')).status, 404);
});
test('rejected and cancelled messages have durable content-free receipts, including cancellation during moderation', async () => {
  mode = 'reject'; const body = input('Do not retain this rejected content.'); const first = await (await send(body)).json() as ChatReceipt; assert.equal(first.reason, 'CONTENT_NOT_ALLOWED'); mode = 'approve'; assert.deepEqual(await (await send(body)).json(), first); assert.ok(!JSON.stringify(context.fixture.state.chatReceipts).includes(body.text));
  mode = 'hold'; const reached = new Promise<void>(resolve => { entered = resolve; }); const second = input(); const pending = send(second); await reached;
  const cancelled = await (await request(`/chat/owner-bob/requests/${second.requestId}/cancel`, 'alice', { confirmed: true })).json() as ChatReceipt; release(); assert.equal(cancelled.reason, 'CANCELLED'); assert.deepEqual(await (await pending).json(), cancelled); assert.equal(context.fixture.state.chatMessages.length, 0);
});
test('replays preserve one message and an owner receipt cannot be retargeted or borrowed', async () => {
  const body = input(); const results = await Promise.all(Array.from({ length: 4 }, () => send(body))); const receipt = await results[0]!.json() as ChatReceipt;
  for (const response of results.slice(1)) assert.deepEqual(await response.json(), receipt); assert.equal(context.fixture.state.chatMessages.length, 1); assert.equal(context.fixture.state.chatThreads[0]!.nextSequence, 1);
  assert.equal((await send(body, 'alice', 'owner-carol')).status, 409); assert.deepEqual(await (await request(`/chat/owner-bob/requests/${body.requestId}`, 'carol')).json(), { receipt: null });
});
test('an open long poll wakes on delivery and private serializers reveal only the two participants’ conversation', async () => {
  const waiting = request('/chat/owner-alice/poll?after=0', 'bob'); await delay(60); const result = await send(input('A live synthetic message.')); assert.equal(result.status, 200);
  const page = await (await waiting).json() as ChatPage; assert.equal(page.messages.length, 1); assert.equal(page.messages[0]!.side, 'theirs'); assert.equal(page.messages[0]!.sequence, 1); assert.equal(page.peer.username, 'alice');
  assert.deepEqual(Object.keys(page.messages[0]!).sort(), ['createdAt', 'id', 'sequence', 'side', 'text']); assert.ok(!JSON.stringify(page).includes('must-not-leak'));
  await send(input('A reply.'), 'bob', 'owner-alice'); const mine = await (await request('/chat/owner-bob')).json() as ChatPage; assert.deepEqual(mine.messages.map(m => m.side), ['mine', 'theirs']);
});
test('polls detect closed gates and abandoned listeners release their slots', async () => {
  const waiting = request('/chat/owner-alice/poll?after=0', 'bob'); await delay(50); await request('/safety/blocks/owner-bob', 'alice', { confirmed: true }); assert.equal((await waiting).status, 404);
  context.fixture.reset(); context.fixture.state.requests.push({ id: 'again', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date() });
  for (let i = 0; i < 5; i++) { const abort = new AbortController(); const pending = request('/chat/owner-bob/poll?after=0', 'alice', undefined, 'GET', abort.signal).catch(() => null); await delay(40); abort.abort(); await pending; await delay(30); }
  assert.equal((await request('/chat/owner-bob')).status, 200);
});
test('bounded pagination and increasing committed sequences do not skip concurrent messages', async () => {
  const result = await (await send()).json() as ChatReceipt; const base = context.fixture.state.chatMessages[0]!;
  for (let i = 2; i <= 125; i++) context.fixture.state.chatMessages.push({ ...base, id: 'chatmsg_' + randomUUID(), sequence: i }); context.fixture.state.chatThreads[0]!.nextSequence = 125;
  const latest = await (await request('/chat/owner-bob')).json() as ChatPage; assert.equal(latest.messages.length, 50); assert.equal(latest.cursor, 125); assert.equal(latest.before, 76);
  const older = await (await request('/chat/owner-bob?before=76')).json() as ChatPage; assert.equal(older.messages[0]!.sequence, 26); assert.equal(older.messages.length, 50);
  const next = await (await request('/chat/owner-bob/poll?after=0')).json() as ChatPage; assert.equal(next.cursor, 50); assert.equal(next.messages[0]!.id, result.messageId);
  const resumed = await (await request('/chat/owner-bob?after=100')).json() as ChatPage; assert.equal(resumed.messages[0]?.sequence, 101); assert.equal(resumed.cursor, 125);
  assert.equal((await request('/chat/owner-bob?before=80&after=10')).status, 400);
  assert.equal((await request('/chat/owner-bob?after=-1')).status, 400);
  const requests = [send(input()), send(input(), 'bob', 'owner-alice'), send(input())]; const receipts = await Promise.all(requests.map(async p => (await (await p).json()) as ChatReceipt)); assert.deepEqual(receipts.map(r => r.sequence).sort(), [126, 127, 128]);
  assert.equal((await request('/chat/owner-bob?before=-1')).status, 400);
});
test('failed receipt commits roll back messages and notifications; a retry creates one of each', async () => {
  context.fixture.state.failReceipt = true; const body = input(); assert.equal((await send(body)).status, 503); assert.equal(context.fixture.state.chatMessages.length, 0); assert.equal(context.fixture.state.chatThreads.length, 0); assert.equal(context.fixture.state.jobs.length,0);
  context.fixture.state.failReceipt = false; assert.equal((await (await send(body)).json() as ChatReceipt).sequence, 1); assert.equal(context.fixture.state.jobs.length, 1);
});
test('only recipients can report, reports deduplicate, and report-and-block is atomic', async () => {
  const receipt = await (await send()).json() as ChatReceipt; const report = { reason: 'SPAM', confirmed: true, blockSender: true };
  for (const owner of ['alice', 'carol']) assert.equal((await request(`/chat/messages/${receipt.messageId}/report`, owner, report)).status, 404);
  const first = await (await request(`/chat/messages/${receipt.messageId}/report`, 'bob', report)).json(); assert.deepEqual(await (await request(`/chat/messages/${receipt.messageId}/report`, 'bob', report)).json(), first);
  assert.equal(context.fixture.state.chatReports.length, 1); assert.equal(context.fixture.state.blocks.length, 1); assert.equal((await request('/chat/owner-bob')).status, 404);
  assert.equal((await request(`/chat/messages/${receipt.messageId}/report`, 'bob', { ...report, detail: 'x'.repeat(501) })).status, 400);
});
test('send budgets leave independent receipt and cancellation routes usable, and the daily limit is durable', async () => {
  const body = input(); for (let i = 0; i < 30; i++) assert.equal((await send(body)).status, 200); assert.equal((await send()).status, 429);
  assert.equal((await request(`/chat/owner-bob/requests/${body.requestId}`)).status, 200); assert.equal((await request(`/chat/owner-bob/requests/${randomUUID()}/cancel`, 'alice', { confirmed: true })).status, 200);
  context.fixture.state.budgets = []; const base = context.fixture.state.chatReceipts[0]!; for (let i = 1; i < 500; i++) context.fixture.state.chatReceipts.push({ ...base, id: 'daily_' + i });
  assert.equal((await (await send()).json() as ChatReceipt).reason, 'DAILY_LIMIT');
});
