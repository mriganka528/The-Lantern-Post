import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import type { BlockedPalacesPage, DeliveryReceipt, FriendConnection, FriendSearchResponse, LetterBoxPage, LetterReportReceipt } from '@lantern-post/shared-types';
import { createFriendsTestApp, friendsFixture } from './friends-fixture';
import { RequestLimits } from '../src/safety/request-limits';
import type { PrismaService } from '../src/database/prisma.service';
import { moderationDecision } from '../src/letters/moderation-deadline';
import { FriendsService } from '../src/friends/friends.service';
import { SafetyService } from '../src/safety/safety.service';
let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
let hold: Promise<void> | null = null; let entered = () => {};
before(async () => { context = await createFriendsTestApp(false, { available: true, check: async () => { entered(); if (hold) await hold; return 'APPROVED'; } }); });
beforeEach(() => { context.fixture.reset(); hold = null; entered = () => {}; context.fixture.state.requests.push({ id: 'friendship_ab', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date(), respondedAt: new Date() }); });
after(async () => context?.app.close());
const request = (path: string, who = 'alice', body?: unknown, method = 'POST') => fetch(context.url + path, { method, headers: { ...(who ? { Authorization: `Bearer ${who}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const block = (who = 'alice', target = 'bob') => request(`/safety/blocks/owner-${target}`, who, { confirmed: true });
const unblock = (who = 'alice', target = 'bob') => request(`/safety/blocks/owner-${target}/unblock`, who, { confirmed: true });
const input = () => ({ requestId: randomUUID(), type: 'TEXT', destinationType: 'FRIEND', textContent: 'Synthetic private words, never copied to a report.', presetId: 'preset_lantern', recipientId: 'owner-bob', deliveryConfirmed: true });
async function deliver() { const body = input(); const response = await request('/letters', 'alice', body); assert.equal(response.status, 200); const receipt = await response.json() as DeliveryReceipt; assert.equal(receipt.outcome, 'DELIVERED'); return { body, receipt }; }
const reportInput = { reason: 'HARASSMENT', detail: 'A synthetic concern.', blockSender: false, confirmed: true };

test('safety endpoints require verified identity before database access and reject spoofed or unconfirmed actions', async () => {
  for (const [path, method] of [['/safety/blocks', 'GET'], ['/safety/blocks/owner-bob', 'POST'], ['/safety/blocks/owner-bob/unblock', 'POST'], ['/safety/letters/foreign/report', 'POST']]) {
    assert.equal((await request(path!, '', method === 'POST' ? { confirmed: true } : undefined, method)).status, 401);
  }
  assert.equal(context.fixture.state.calls, 0);
  for (const invalid of [{}, { confirmed: false }, { confirmed: 'true' }, { confirmed: true, blockerId: 'owner-carol' }]) assert.equal((await request('/safety/blocks/owner-bob', 'alice', invalid)).status, 400);
  assert.equal((await block('alice', 'alice')).status, 404); assert.equal((await block('alice', 'missing')).status, 404); assert.equal(context.fixture.state.blocks.length, 0);
});
test('blocking is idempotent, ends the friendship and hides mail, search and invitations in both directions', async () => {
  const { receipt } = await deliver();
  const replies = await Promise.all([block(), block()]); assert.ok(replies.every(r => r.status === 200)); assert.equal(context.fixture.state.blocks.length, 1); assert.equal(context.fixture.state.requests[0]!.status, 'BLOCKED');
  for (const [who, other] of [['alice', 'bob'], ['bob', 'alice']]) {
    assert.deepEqual((await (await request(`/friends/search?username=${other}`, who, undefined, 'GET')).json() as FriendSearchResponse).results, []);
    assert.equal((await request(`/letters/friends/${receipt.letterId}/open`, who)).status, 404);
    assert.equal((await request('/friends/requests', who, { username: other })).status, 404);
    assert.deepEqual((await (await request('/letters/friends?box=received', who, undefined, 'GET')).json() as LetterBoxPage).letters, []);
  }
  assert.equal(context.fixture.state.letters[0]!.textContent, input().textContent, 'Closing a gate hides correspondence without deleting it.');
  assert.equal((await request('/friends/requests/friendship_ab/respond', 'bob', { action: 'accept' })).status, 404);
});
test('only your own blocks are listed or removed; unblocking never recreates accepted friendship', async () => {
  await block(); await block('bob', 'alice'); await unblock('carol', 'bob'); assert.equal(context.fixture.state.blocks.length, 2);
  const page = await (await request('/safety/blocks', 'alice', undefined, 'GET')).json() as BlockedPalacesPage;
  assert.deepEqual(page.items.map(x => x.username), ['bob']); assert.ok(!JSON.stringify(page).includes('authProviderId')); assert.ok(!JSON.stringify(page).includes('privateField'));
  assert.deepEqual((await (await request('/safety/blocks', 'carol', undefined, 'GET')).json() as BlockedPalacesPage).items, []);
  await unblock(); assert.equal(context.fixture.state.blocks.length, 1); assert.equal(context.fixture.state.requests[0]!.status, 'BLOCKED');
  await unblock('bob', 'alice'); assert.equal(context.fixture.state.requests[0]!.status, 'DECLINED');
  const fresh = await (await request('/friends/requests', 'alice', { username: 'bob' })).json() as FriendConnection; assert.equal(fresh.status, 'PENDING'); assert.notEqual(fresh.id, 'friendship_ab');
  assert.equal((await request('/friends/requests/friendship_ab/respond', 'bob', { action: 'accept' })).status, 404);
});
test('blocking during moderation prevents late delivery and retires pending voice uploads', async () => {
  let release!: () => void; hold = new Promise(resolve => { release = resolve; }); const reached = new Promise<void>(resolve => { entered = resolve; });
  context.fixture.state.voiceAssets.push({ id: 'voice_pending', ownerId: 'owner-alice', recipientId: 'owner-bob', status: 'READY', sha256: 'synthetic', purgeAfter: null });
  const sending = request('/letters', 'alice', input()); await reached; assert.equal((await block('bob', 'alice')).status, 200); release();
  const receipt = await (await sending).json() as DeliveryReceipt; assert.equal(receipt.reason, 'FRIEND_UNAVAILABLE'); assert.equal(context.fixture.state.letters.length, 0); assert.equal(context.fixture.state.voiceAssets[0]!.status, 'DELETED');
});
test('reports are recipient-only, validated, deduplicated and contain no automatic copy of private letter content', async () => {
  const { receipt, body } = await deliver(); const path = `/safety/letters/${receipt.letterId}/report`;
  for (const who of ['alice', 'carol']) assert.equal((await request(path, who, reportInput)).status, 404);
  for (const invalid of [{ ...reportInput, reason: 'made-up' }, { ...reportInput, detail: 'x'.repeat(1001) }, { ...reportInput, reporterId: 'owner-alice' }, { ...reportInput, blockSender: 'true' }, { ...reportInput, confirmed: false }]) assert.equal((await request(path, 'bob', invalid)).status, 400);
  const reports = await Promise.all([request(path, 'bob', reportInput), request(path, 'bob', reportInput)]);
  const first = await reports[0]!.json() as LetterReportReceipt; assert.deepEqual(await reports[1]!.json(), first); assert.equal(first.status, 'OPEN'); assert.equal(context.fixture.state.reports.length, 1);
  assert.equal(context.fixture.state.reports[0]!.reportedUserId, 'owner-alice'); assert.ok(!JSON.stringify(context.fixture.state.reports).includes(body.textContent)); assert.equal(context.fixture.state.blocks.length, 0);
  context.fixture.state.reports[0]!.status = 'ACTIONED'; context.fixture.state.budgets = [];
  const retried = await (await request(path, 'bob', { ...reportInput, detail: 'A changed retry' })).json() as LetterReportReceipt;
  assert.equal(retried.status, 'ACTIONED'); assert.equal(context.fixture.state.reports[0]!.detail, reportInput.detail);
});
test('report-and-block commits together and a recipient can report previously received mail after blocking', async () => {
  const { receipt } = await deliver(); assert.equal((await block('bob', 'alice')).status, 200);
  const saved = await (await request(`/safety/letters/${receipt.letterId}/report`, 'bob', { ...reportInput, blockSender: true })).json() as LetterReportReceipt;
  assert.equal(saved.blocked, true); assert.equal(context.fixture.state.blocks.length, 1); assert.equal(context.fixture.state.reports.length, 1);
  context.fixture.state.letters.push({ id: 'burned_stub', senderId: 'owner-alice', recipientId: 'owner-bob', type: 'TEXT', destinationType: 'BURNING', status: 'HARD_DELETED', moderationPassed: null });
  assert.equal((await request('/safety/letters/burned_stub/report', 'bob', reportInput)).status, 404);
});
test('request budgets are shared across service instances and concurrency, expire, and expose no subject or content', async () => {
  const fixture = friendsFixture(); const database = fixture.database as unknown as PrismaService; const budget = { scope: 'fixture-operation', maximum: 2, milliseconds: 60000 };
  const now = 600000; const one = new RequestLimits(database); const two = new RequestLimits(database);
  const replies = await Promise.allSettled([one.consume('private-subject', budget, now), two.consume('private-subject', budget, now), one.consume('private-subject', budget, now)]);
  assert.equal(replies.filter(result => result.status === 'fulfilled').length, 2); assert.equal(fixture.state.budgets[0]!.count, 2); assert.ok(!JSON.stringify(fixture.state.budgets).includes('private-subject'));
  await assert.rejects(new RequestLimits(database).consume('private-subject', budget, now)); await one.consume('another-subject', budget, now); await one.consume('private-subject', budget, now + 60000);
  fixture.state.conflicts = 4; await assert.rejects(one.consume('third-subject', budget, now), error => typeof error === 'object' && error !== null && 'status' in error && error.status === 503);
});
test('send throttling returns Retry-After and keeps receipt lookup and durable cancellation available', async () => {
  for (let i = 0; i < 30; i++) assert.equal((await request('/letters', 'alice', { invalid: true })).status, 400);
  const body = input(); const limited = await request('/letters', 'alice', body); assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) >= 1); assert.equal(context.fixture.state.letters.length, 0);
  assert.equal((await request(`/letters/friends/requests/${body.requestId}`, 'alice', undefined, 'GET')).status, 200);
  const cancel = await request(`/letters/friends/requests/${body.requestId}/cancel`, 'alice', { recipientId: body.recipientId }); assert.equal(cancel.status, 200); assert.equal((await cancel.json() as DeliveryReceipt).reason, 'CANCELLED');
  assert.equal((await request('/letters', 'bob', { invalid: true })).status, 400);
});

test('moderation deadlines cancel stalled checks and reject malformed or late approvals', async () => {
  let signal: AbortSignal | undefined; let release!: (value: string) => void; let continued = false;
  const outcome = moderationDecision(current => { signal = current; return new Promise(resolve => { release = resolve; }); }, 15).then(() => { continued = true; });
  await assert.rejects(outcome, /timed out/); assert.equal(signal!.aborted, true); release('APPROVED'); await Promise.resolve(); assert.equal(continued, false);
  await assert.rejects(moderationDecision(async () => ({ approved: true }), 100)); assert.equal(await moderationDecision(async () => 'REJECTED', 100), 'REJECTED');
});

test('cycling block and unblock cannot reset the durable daily invitation allowance', async () => {
  context.fixture.state.requests = []; const friends = context.app.get(FriendsService); const safety = context.app.get(SafetyService);
  for (let i = 0; i < 20; i++) { await friends.send('alice', 'bob'); await safety.block('alice', 'owner-bob'); await safety.unblock('alice', 'owner-bob'); }
  assert.equal(context.fixture.state.requests.length, 1);
  await assert.rejects(friends.send('alice', 'bob'), error => typeof error === 'object' && error !== null && 'status' in error && error.status === 429);
});
