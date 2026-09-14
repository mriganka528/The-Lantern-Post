import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import type { DeliveryReceipt, FriendTextLetterRequest, LetterBoxPage, OpenedFriendLetter } from '@lantern-post/shared-types';
import { createFriendsTestApp } from './friends-fixture';

let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
let moderation: 'APPROVED' | 'REJECTED' | 'UNAVAILABLE' | 'BROKEN' = 'APPROVED';
let checks: string[] = []; let waitForModeration: Promise<void> | null = null;
before(async () => { context = await createFriendsTestApp(true, { available: true, check: async text => { checks.push(text); if (waitForModeration) await waitForModeration; if (moderation === 'UNAVAILABLE') throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE' }); if (moderation === 'BROKEN') throw new Error('Synthetic private provider error: ' + text); return moderation; } }); });
beforeEach(() => {
  context.fixture.reset(); checks = []; moderation = 'APPROVED'; waitForModeration = null;
  context.fixture.state.requests.push({ id: 'friendship_ab', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date(), respondedAt: new Date() });
});
after(async () => { await context?.app.close(); });
const input = (recipientId = 'owner-bob'): FriendTextLetterRequest => ({ requestId: randomUUID(), type: 'TEXT', destinationType: 'FRIEND', textContent: 'Dear friend, the garden is a little brighter with you in it.', presetId: 'preset_lantern', recipientId, deliveryConfirmed: true });
const request = (path: string, who = 'alice', body?: unknown, post = false) => fetch(`${context.url}${path}`, { method: post || body !== undefined ? 'POST' : 'GET', headers: { ...(who ? { Authorization: `Bearer ${who}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
const send = (body = input(), who = 'alice') => request('/letters', who, body);
const open = (id: string, who = 'bob') => request(`/letters/friends/${id}/open`, who, undefined, true);
const list = (who = 'bob', box = 'received', cursor = '') => request(`/letters/friends?box=${box}${cursor ? `&cursor=${cursor}` : ''}`, who);
const cancel = (body: FriendTextLetterRequest, who = 'alice') => request(`/letters/friends/requests/${body.requestId}/cancel`, who, { recipientId: body.recipientId });

test('all private-letter paths reject missing/forged authentication before data access', async () => {
  for (const who of ['', 'forged']) {
    assert.equal((await send(input(), who)).status, 401); assert.equal((await list(who)).status, 401);
    assert.equal((await open('letter-id', who)).status, 401); assert.equal((await request('/letters/friends/summary', who)).status, 401);
    assert.equal((await cancel(input(), who)).status, 401); assert.equal((await request('/letters/friends/requests/' + randomUUID(), who)).status, 401);
    assert.equal((await request('/letters/friends/letter-id/delete', who, undefined, true)).status, 401);
  }
  assert.equal(context.fixture.state.calls, 0); assert.equal(checks.length, 0);
});
test('friend bodies require explicit confirmation and reject spoofing, voice, public fields and malformed text', async () => {
  const valid = input();
  for (const body of [{ ...valid, deliveryConfirmed: false }, { ...valid, deliveryConfirmed: 'true' }, { ...valid, recipientId: '' }, { ...valid, requestId: 'bad' }, { ...valid, textContent: '  ' }, { ...valid, textContent: '💛'.repeat(2001) }, { ...valid, senderId: 'owner-carol' }, { ...valid, moderationPassed: true }, { ...valid, burnConfirmed: true }, { ...valid, isSigned: true }, { ...valid, audioUrl: 'https://invalid.test' }, { ...valid, type: 'VOICE' }, { ...valid, destinationType: 'INFINITY' }]) assert.equal((await request('/letters', 'alice', body)).status, 400);
  assert.equal((await request('/letters/friends?box=everyone')).status, 400); assert.equal((await request('/letters/friends?cursor=not-a-valid-cursor')).status, 400);
  assert.equal(checks.length, 0); assert.equal(context.fixture.state.letters.length, 0);
});
test('moderation approval precedes persistence, receipt and outbox commit; envelopes never include text', async () => {
  let release = () => {}; waitForModeration = new Promise<void>(resolve => { release = resolve; });
  const body = input(); const sending = send(body);
  while (!checks.length) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(context.fixture.state.letters.length, 0); assert.equal(context.fixture.state.jobs.length, 0);
  release(); const response = await sending; assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json() as DeliveryReceipt; assert.equal(result.outcome, 'DELIVERED'); assert.ok(!JSON.stringify(result).includes(body.textContent));
  const letter = context.fixture.state.letters[0]!; assert.equal(letter.textContent, body.textContent); assert.equal(letter.moderationPassed, true); assert.equal(letter.status, 'DELIVERED');
  assert.equal(context.fixture.state.receipts.length, 1); assert.equal(context.fixture.state.jobs.length, 1); assert.equal(context.fixture.state.jobs[0]!.kind, 'LETTER_DELIVERED');
  const envelopes = await (await list()).json() as LetterBoxPage; assert.equal(envelopes.letters.length, 1); assert.equal(envelopes.letters[0]!.person.username, 'alice');
  for (const forbidden of [body.textContent, 'textContent', 'authProviderId', 'must-not-leak', 'privateField']) assert.ok(!JSON.stringify(envelopes).includes(forbidden));
});
test('a rejected letter persists only a durable rejection and can never become a later delivery on that ID', async () => {
  moderation = 'REJECTED'; const body = input(); const first = await (await send(body)).json() as DeliveryReceipt;
  assert.equal(first.outcome, 'REJECTED'); assert.equal(first.reason, 'CONTENT_NOT_ALLOWED'); assert.equal(context.fixture.state.letters.length, 0); assert.equal(context.fixture.state.jobs.length, 0);
  assert.ok(!JSON.stringify(context.fixture.state.receipts).includes(body.textContent));
  moderation = 'APPROVED'; assert.deepEqual(await (await send(body)).json(), first); assert.equal(checks.length, 1);
});
test('a missing live moderator leaves delivery unconfirmed and never stores or exposes the words', async () => {
  moderation = 'UNAVAILABLE'; const body = input(); const response = await send(body); assert.equal(response.status, 503);
  assert.equal(context.fixture.state.letters.length, 0); assert.equal(context.fixture.state.receipts.length, 0);
  assert.deepEqual(await (await request(`/letters/friends/requests/${body.requestId}`)).json(), { receipt: null });
  moderation = 'BROKEN'; const failure = await send(body); assert.equal(failure.status, 503); assert.ok(!(await failure.text()).includes(body.textContent));
  const productionDefault = await createFriendsTestApp();
  try {
    assert.deepEqual(await (await fetch(`${productionDefault.url}/letters/friends/capabilities`, { headers: { Authorization: 'Bearer alice' } })).json(), { textAvailable: false, voiceAvailable: false, voiceStorageAvailable: false });
    productionDefault.fixture.state.requests.push({ id: 'accepted_ab', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date(), respondedAt: new Date() });
    const response = await fetch(`${productionDefault.url}/letters`, { method: 'POST', headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' }, body: JSON.stringify(input()) });
    assert.equal(response.status, 503); assert.equal(productionDefault.fixture.state.letters.length, 0);
  }
  finally { await productionDefault.app.close(); }
});
test('only current mutual friends can receive; pending, self, missing, blocked and retired gates are rejected before moderation', async () => {
  for (const recipient of ['owner-carol', 'owner-alice', 'missing', 'owner-bert']) {
    const result = await (await send(input(recipient))).json() as DeliveryReceipt; assert.equal(result.reason, 'FRIEND_UNAVAILABLE');
  }
  context.fixture.state.requests[0]!.status = 'PENDING'; assert.equal((await (await send()).json() as DeliveryReceipt).reason, 'FRIEND_UNAVAILABLE');
  context.fixture.state.requests[0]!.status = 'ACCEPTED'; context.fixture.state.blocks.push({ blockerId: 'owner-bob', blockedId: 'owner-alice' });
  assert.equal((await (await send()).json() as DeliveryReceipt).reason, 'FRIEND_UNAVAILABLE'); assert.equal(checks.length, 0);
});
test('friendship and stationery are checked again after moderation finishes', async () => {
  let release = () => {}; waitForModeration = new Promise<void>(resolve => { release = resolve; });
  const sending = send(); while (!checks.length) await new Promise(resolve => setTimeout(resolve, 5));
  context.fixture.state.blocks.push({ blockerId: 'owner-alice', blockedId: 'owner-bob' }); release();
  assert.equal((await (await sending).json() as DeliveryReceipt).reason, 'FRIEND_UNAVAILABLE'); assert.equal(context.fixture.state.letters.length, 0);
  waitForModeration = null; context.fixture.state.blocks = []; context.fixture.state.presets[0]!.isActive = false;
  assert.equal((await (await send()).json() as DeliveryReceipt).reason, 'PRESET_UNAVAILABLE');
});
test('duplicate and changed-body retries deliver at most once, and receipts belong only to the sender', async () => {
  const body = input(); const responses = await Promise.all(Array.from({ length: 6 }, () => send(body))); assert.ok(responses.every(r => r.status === 200));
  const results = await Promise.all(responses.map(r => r.json())); results.forEach(r => assert.deepEqual(r, results[0]));
  assert.equal(context.fixture.state.letters.length, 1); assert.equal(context.fixture.state.jobs.length, 1);
  assert.deepEqual(await (await send({ ...body, textContent: 'Changed retry', recipientId: 'owner-carol' })).json(), results[0]);
  assert.equal(context.fixture.state.letters[0]!.textContent, body.textContent);
  assert.deepEqual(await (await request(`/letters/friends/requests/${body.requestId}`, 'bob')).json(), { receipt: null });
});
test('cancelling a held delivery prevents a later approved result from sending; delivered letters cannot be cancelled retroactively', async () => {
  let release = () => {}; waitForModeration = new Promise<void>(resolve => { release = resolve; }); const body = input(); const sending = send(body);
  while (!checks.length) await new Promise(resolve => setTimeout(resolve, 5));
  const cancelled = await (await cancel(body)).json() as DeliveryReceipt; assert.equal(cancelled.reason, 'CANCELLED'); release();
  assert.deepEqual(await (await sending).json(), cancelled); assert.equal(context.fixture.state.letters.length, 0);
  waitForModeration = null; const next = input(); const delivered = await (await send(next)).json(); assert.deepEqual(await (await cancel(next)).json(), delivered);
});
test('receipt/outbox failures roll back text persistence and leave the original request safe to retry', async () => {
  const body = input(); context.fixture.state.failReceipt = true; assert.equal((await send(body)).status, 503); assert.equal(context.fixture.state.letters.length, 0);
  context.fixture.state.failReceipt = false; context.fixture.state.failJob = true; assert.equal((await send(body)).status, 503); assert.equal(context.fixture.state.letters.length, 0); assert.equal(context.fixture.state.receipts.length, 0);
  context.fixture.state.failJob = false; assert.equal((await send(body)).status, 200); assert.equal(context.fixture.state.letters.length, 1);
});
test('reads are participant-only and require current friendship; only recipient openings mark read', async () => {
  const body = input(); const result = await (await send(body)).json() as DeliveryReceipt;
  assert.equal((await open(result.letterId!, 'carol')).status, 404);
  const senderView = await (await open(result.letterId!, 'alice')).json() as OpenedFriendLetter; assert.equal(senderView.textContent, body.textContent); assert.equal(context.fixture.state.letters[0]!.readAt, null);
  const recipientView = await (await open(result.letterId!)).json() as OpenedFriendLetter; assert.equal(recipientView.textContent, body.textContent); assert.ok(recipientView.readAt);
  assert.equal((await (await open(result.letterId!, 'alice')).json() as OpenedFriendLetter).readAt, null, 'No read receipt is exposed to the sender.');
  assert.deepEqual(await (await request('/letters/friends/summary', 'bob')).json(), { unread: 0, received: 1, sent: 0 });
  context.fixture.state.requests[0]!.status = 'DECLINED'; assert.equal((await open(result.letterId!)).status, 404); assert.equal((await (await list()).json() as LetterBoxPage).letters.length, 0);
});
test('stationery is preserved after catalog changes and neither burned nor unapproved rows can be read', async () => {
  const result = await (await send()).json() as DeliveryReceipt; const before = await (await open(result.letterId!)).json() as OpenedFriendLetter;
  context.fixture.state.presets[0]!.configJson = { invalid: true }; const afterChange = await (await open(result.letterId!)).json() as OpenedFriendLetter; assert.deepEqual(afterChange.preset, before.preset);
  context.fixture.state.letters[0]!.moderationPassed = false; assert.equal((await open(result.letterId!)).status, 404);
  context.fixture.state.letters[0]!.moderationPassed = true; context.fixture.state.letters[0]!.destinationType = 'BURNING'; assert.equal((await open(result.letterId!)).status, 404);
});
test('each participant removes only their own copy; both removals clear content without receipt resurrection', async () => {
  const body = input(); const result = await (await send(body)).json() as DeliveryReceipt;
  assert.equal((await request(`/letters/friends/${result.letterId}/delete`, 'carol', undefined, true)).status, 404);
  assert.equal((await request(`/letters/friends/${result.letterId}/delete`, 'bob', undefined, true)).status, 200);
  assert.equal(context.fixture.state.letters[0]!.textContent, body.textContent);assert.ok(context.fixture.state.letters[0]!.recipientDeletedAt);assert.equal((await open(result.letterId!)).status,404);assert.equal((await open(result.letterId!, 'alice')).status,200);
  assert.equal((await request(`/letters/friends/${result.letterId}/delete`, 'alice', undefined, true)).status,200);assert.equal(context.fixture.state.letters[0]!.textContent,null);assert.equal(context.fixture.state.letters[0]!.stationeryJson,null);assert.equal(context.fixture.state.letters[0]!.status,'HARD_DELETED');
  assert.equal((await open(result.letterId!)).status, 404); assert.deepEqual(await (await send(body)).json(), result); assert.equal(context.fixture.state.letters[0]!.textContent, null);
});
test('letter notification delivery contains no text and skips a letter already opened or blocked', async () => {
  const body = input(); const result = await (await send(body)).json() as DeliveryReceipt;
  await request('/notifications/register', 'bob', { token: 'ExpoPushToken[synthetic-letter-device]', platform: 'android' });
  const original = globalThis.fetch; const notifications: Record<string, unknown>[] = [];
  globalThis.fetch = (async (url, init) => { if (String(url) !== 'https://exp.host/--/api/v2/push/send') return original(url, init); notifications.push(...JSON.parse(String(init?.body)) as Record<string, unknown>[]); return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'letter-ticket' }] })); }) as typeof fetch;
  try {
    await context.notifications.dispatch(); assert.equal(notifications.length, 1); assert.equal((notifications[0]!.data as Record<string, unknown>).screen, 'inbox'); assert.ok(!JSON.stringify(notifications).includes(body.textContent));
    await open(result.letterId!); context.fixture.state.jobs[0]!.completedAt = null; await context.notifications.dispatch(); assert.equal(notifications.length, 1);
  } finally { globalThis.fetch = original; }
});

test('envelope pagination stays bounded and cannot be used to browse another owner’s box', async () => {
  await send(); const original = context.fixture.state.letters[0]!;
  for (let i = 0; i < 25; i++) context.fixture.state.letters.push({ ...original, id: `delivery_${String(i).padStart(64, '0')}`, deliveredAt: new Date(1700000000000 + i) });
  const first = await (await list()).json() as LetterBoxPage; assert.equal(first.letters.length, 24); assert.ok(first.nextCursor);
  const second = await (await list('bob', 'received', first.nextCursor!)).json() as LetterBoxPage; assert.equal(second.letters.length, 2); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.letters, ...second.letters].map(l => l.id)).size, 26);
  assert.deepEqual(await (await list('carol', 'received', first.nextCursor!)).json(), { letters: [], nextCursor: null });
  assert.ok(!JSON.stringify([first, second]).includes(String(original.textContent)));
});
test('the daily send limit runs before moderation and retries or deleted content cannot bypass it', async () => {
  const body = input(); const delivered = await (await send(body)).json() as DeliveryReceipt; const original = context.fixture.state.letters[0]!;
  for (let i = 0; i < 49; i++) {
    const id = `delivery_${String(i).padStart(64, '0')}`;
    context.fixture.state.letters.push({ ...original, id, deliveredAt: new Date() });
    context.fixture.state.receipts.push({ ...context.fixture.state.receipts[0]!, id, letterId: id, createdAt: new Date() });
  }
  const before = checks.length; const rejected = await (await send()).json() as DeliveryReceipt; assert.equal(rejected.reason, 'DELIVERY_LIMIT'); assert.equal(checks.length, before);
  assert.deepEqual(await (await send(body)).json(), delivered);
  await request(`/letters/friends/${delivered.letterId}/delete`, 'bob', undefined, true);
  context.fixture.state.letters = []; // A later content-purge job cannot reset the receipt-based limit.
  assert.equal((await (await send()).json() as DeliveryReceipt).reason, 'DELIVERY_LIMIT');
});
