import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { ServiceUnavailableException } from '@nestjs/common';
import type { BlockedPalacesPage, WorldLetter, WorldPage, WorldReceipt, WorldTextRequest, VoiceUploadGrant } from '@lantern-post/shared-types';
import { createFriendsTestApp } from './friends-fixture';
import { memoryVoiceStorage, syntheticWebm } from './voice-fixture';
let context: Awaited<ReturnType<typeof createFriendsTestApp>>; const storage = memoryVoiceStorage();
let mode: 'approve' | 'reject' | 'unavailable' | 'hold' = 'approve'; let entered = () => {}; let release = () => {}; let checks = 0;
const check = async () => { checks++; entered(); if (mode === 'hold') await new Promise<void>(resolve => { release = resolve; }); if (mode === 'unavailable') throw new ServiceUnavailableException(); return mode === 'reject' ? 'REJECTED' as const : 'APPROVED' as const; };
before(async () => { context = await createFriendsTestApp(false, { available: true, voiceAvailable: true, check, checkVoice: check }, storage.storage); });
beforeEach(() => { context.fixture.reset(); mode = 'approve'; checks = 0; entered = () => {}; release = () => {}; storage.objects.clear(); storage.calls.length = 0; });
after(async () => context?.app.close());
const input = (isSigned = false): WorldTextRequest => ({ requestId: randomUUID(), destinationType: 'INFINITY', type: 'TEXT', textContent: 'Synthetic words under the moon.', presetId: 'preset_lantern', isSigned, publicConfirmed: true });
const request = (path: string, who = 'alice', body?: unknown, method = 'POST') => fetch(context.url + path, { method, headers: { ...(who ? { Authorization: `Bearer ${who}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const send = (body = input()) => request('/letters', 'alice', body);
const all = '/infinity/stars?minX=0&maxX=1600&minY=0&maxY=1000';
async function delivered(signed = false) { const body = input(signed); const response = await send(body); assert.equal(response.status, 200); const receipt = await response.json() as WorldReceipt; assert.equal(receipt.outcome, 'DELIVERED'); return { body, receipt }; }

test('Infinity endpoints authenticate before data access and public sharing requires explicit bounded intent', async () => {
  for (const [path, method] of [[all, 'GET'], ['/infinity/mine', 'GET'], ['/infinity/capabilities', 'GET'], ['/infinity/stars/foreign/open', 'POST'], ['/infinity/stars/foreign/block', 'POST']]) assert.equal((await request(path!, '', undefined, method)).status, 401);
  assert.equal(context.fixture.state.calls, 0);
  const valid = input(); for (const body of [{ ...valid, publicConfirmed: false }, { ...valid, isSigned: 'false' }, { ...valid, isSigned: undefined }, { ...valid, posX: 42 }, { ...valid, senderId: 'owner-bob' }, { ...valid, recipientId: 'owner-bob' }, { ...valid, moderationPassed: true }, { ...valid, textContent: '💛'.repeat(2001) }, { ...valid, textContent: '' }]) assert.equal((await send(body as WorldTextRequest)).status, 400);
  assert.equal(context.fixture.state.letters.length, 0);
});
test('approval precedes public persistence; coordinates and opaque public IDs are assigned only by the server', async () => {
  mode = 'hold'; const reached = new Promise<void>(resolve => { entered = resolve; }); const body = input(); const pending = send(body); await reached;
  assert.equal(context.fixture.state.letters.length, 0); assert.equal(context.fixture.state.worldReceipts.length, 0); release(); const result = await (await pending).json() as WorldReceipt;
  assert.match(result.letterId!, /^star_[a-f0-9-]{36}$/); assert.notEqual(result.letterId, result.receiptId); assert.ok(!JSON.stringify(result).includes(body.textContent));
  const row = context.fixture.state.letters[0]!; assert.equal(row.isSigned, false); assert.equal(row.recipientId, null); assert.ok(Number(row.posX) >= 0 && Number(row.posX) <= 1600); assert.ok(Number(row.posY) >= 0 && Number(row.posY) <= 1000); assert.equal(context.fixture.state.jobs.length, 0);
});
test('required mode and provider outages fail closed; rejections are durable without storing content', async () => {
  const original = context; const isolated = await createFriendsTestApp(false);
  try { context = isolated; assert.equal((await send()).status, 503); assert.equal(context.fixture.state.letters.length, 0); } finally { context = original; await isolated.app.close(); }
  mode = 'unavailable'; assert.equal((await send()).status, 503); assert.equal(context.fixture.state.worldReceipts.length, 0);
  mode = 'reject'; const body = input(); const rejected = await (await send(body)).json() as WorldReceipt; assert.equal(rejected.reason, 'CONTENT_NOT_ALLOWED'); assert.equal(context.fixture.state.letters.length, 0);
  mode = 'approve'; assert.deepEqual(await (await send(body)).json(), rejected); assert.equal(context.fixture.state.letters.length, 0);
});
test('unsigned public lists and opened letters never serialize author identity; signing reveals only the username', async () => {
  const anonymous = await delivered(); const signed = await delivered(true);
  const page = await (await request(all, 'bob', undefined, 'GET')).json() as WorldPage;
  assert.equal(page.stars.length, 2); for (const star of page.stars) assert.deepEqual(Object.keys(star).sort(), ['id', 'type', 'x', 'y']);
  const opened = await (await request(`/infinity/stars/${anonymous.receipt.letterId}/open`, 'bob')).json() as WorldLetter;
  assert.equal(opened.signature, null); assert.equal(opened.mine, false); for (const forbidden of ['owner-alice', 'authProviderId', 'senderId', 'privateField']) assert.ok(!JSON.stringify(opened).includes(forbidden));
  const named = await (await request(`/infinity/stars/${signed.receipt.letterId}/open`, 'bob')).json() as WorldLetter;
  assert.equal(named.signature, 'alice'); assert.ok(!JSON.stringify(named).includes('owner-alice')); assert.ok(!JSON.stringify(page).includes('alice'));
});
test('public duplicates, receipt lookup, cancellation races and failed receipt commits preserve one outcome', async () => {
  const body = input(); const results = await Promise.all(Array.from({ length: 4 }, () => send(body))); const first = await results[0]!.json() as WorldReceipt;
  for (const result of results.slice(1)) assert.deepEqual(await result.json(), first); assert.equal(context.fixture.state.letters.length, 1);
  assert.deepEqual(await (await request(`/infinity/requests/${body.requestId}`, 'bob', undefined, 'GET')).json(), { receipt: null });
  assert.deepEqual(await (await request(`/infinity/requests/${body.requestId}/cancel`, 'alice', { isSigned: true })).json(), first);
  mode = 'hold'; const reached = new Promise<void>(resolve => { entered = resolve; }); const other = input(); const pending = send(other); await reached;
  const cancelled = await (await request(`/infinity/requests/${other.requestId}/cancel`, 'alice', { isSigned: false })).json() as WorldReceipt; release(); assert.equal(cancelled.reason, 'CANCELLED'); assert.deepEqual(await (await pending).json(), cancelled);
  mode = 'approve'; context.fixture.state.failReceipt = true; assert.equal((await send()).status, 503); assert.equal(context.fixture.state.letters.length, 1);
});
test('viewport pagination is bounded, scoped and independent from private mail; own lights stay owner-only', async () => {
  await delivered(); const original = context.fixture.state.letters[0]!; original.posX = 400; original.posY = 400; original.deliveredAt = new Date('2026-01-01');
  for (let i = 0; i < 72; i++) context.fixture.state.letters.push({ ...original, id: `star_${randomUUID()}`, deliveredAt: new Date(1700000000000 + i), posX: i < 65 ? 410 : 1400 });
  context.fixture.state.letters.push({ ...original, id: 'private-letter', destinationType: 'FRIEND', recipientId: 'owner-bob' }, { ...original, id: 'not-approved', moderationPassed: false });
  const area = '/infinity/stars?minX=0&maxX=800&minY=0&maxY=700'; const first = await (await request(area, 'bob', undefined, 'GET')).json() as WorldPage; assert.equal(first.stars.length, 60); assert.ok(first.nextCursor);
  const second = await (await request(area + '&cursor=' + first.nextCursor, 'bob', undefined, 'GET')).json() as WorldPage; assert.equal(second.stars.length, 6); assert.equal(new Set([...first.stars, ...second.stars].map(s => s.id)).size, 66);
  assert.equal((await request(all + '&cursor=' + first.nextCursor, 'bob', undefined, 'GET')).status, 400);
  for (const query of ['minX=900&maxX=1&minY=0&maxY=1000', 'minX=-1&maxX=100&minY=0&maxY=1000', 'minX=0&maxX=Infinity&minY=0&maxY=1000']) assert.equal((await request('/infinity/stars?' + query, 'bob', undefined, 'GET')).status, 400);
  assert.deepEqual((await (await request('/infinity/mine', 'bob', undefined, 'GET')).json() as WorldPage).stars, []);
  assert.equal((await request('/infinity/stars/private-letter/open', 'bob')).status, 404);
});
test('reporting and blocking an unsigned public letter never reveals its author in closed gates or receipts', async () => {
  const { receipt } = await delivered();
  const reported = await request(`/safety/letters/${receipt.letterId}/report`, 'bob', { reason: 'SPAM', blockSender: true, confirmed: true }); assert.equal(reported.status, 200);
  const reply = await reported.text(); assert.ok(!reply.includes('alice')); assert.ok(!reply.includes('owner-alice'));
  const closed = await (await request('/safety/blocks', 'bob', undefined, 'GET')).json() as BlockedPalacesPage;
  assert.equal(closed.items[0]!.username, null); assert.match(closed.items[0]!.id, /^closed_/); assert.ok(!JSON.stringify(closed).includes('alice'));
  assert.deepEqual((await (await request(all, 'bob', undefined, 'GET')).json() as WorldPage).stars, []); assert.equal((await request(`/infinity/stars/${receipt.letterId}/open`, 'bob')).status, 404);
  assert.equal((await request(`/safety/blocks/${closed.items[0]!.id}/unblock`, 'carol', { confirmed: true })).status, 200); assert.equal(context.fixture.state.blocks.length, 1);
  await request(`/safety/blocks/${closed.items[0]!.id}/unblock`, 'bob', { confirmed: true }); assert.equal(context.fixture.state.blocks.length, 0);
  assert.equal((await request(`/infinity/stars/${receipt.letterId}/block`, 'bob', { confirmed: true })).status, 200);
  assert.deepEqual((await (await request(all, 'bob', undefined, 'GET')).json() as WorldPage).stars, []);
});
test('only the author can remove a public letter and neither deletion nor retries reset its publication allowance', async () => {
  const { body, receipt } = await delivered(); assert.equal((await request(`/infinity/stars/${receipt.letterId}/delete`, 'bob', { confirmed: true })).status, 404);
  assert.equal((await request(`/infinity/stars/${receipt.letterId}/delete`, 'alice', { confirmed: true })).status, 200); assert.equal((await request(`/infinity/stars/${receipt.letterId}/open`, 'alice')).status, 404); assert.equal(context.fixture.state.letters[0]!.textContent, null);
  assert.deepEqual(await (await send(body)).json(), receipt); assert.equal(context.fixture.state.letters.length, 1);
  for (let i = 0; i < 19; i++) context.fixture.state.worldReceipts.push({ ...context.fixture.state.worldReceipts[0], id: 'old_' + i });
  const before = checks; assert.equal((await (await send()).json() as WorldReceipt).reason, 'DELIVERY_LIMIT'); assert.equal(checks, before);
});
test('voice assets are bound to public versus private destinations and public playback needs approval', async () => {
  const bytes = syntheticWebm(); const id = randomUUID(); const upload = { requestId: id, destinationType: 'INFINITY', mimeType: 'audio/webm', byteLength: bytes.length, durationMs: 2000, sha256: createHash('sha256').update(bytes).digest('base64') };
  assert.equal((await request('/voice/uploads', 'alice', { ...upload, recipientId: 'owner-bob' })).status, 400);
  const grant = await (await request('/voice/uploads', 'alice', upload)).json() as VoiceUploadGrant; assert.match(grant.assetId, /^voice_/); storage.objects.set('voice/incoming/' + grant.assetId, bytes); assert.equal((await request(`/voice/uploads/${grant.assetId}/finish`)).status, 200);
  context.fixture.state.requests.push({ id: 'friends', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date(), respondedAt: new Date() });
  const privateTry = await request('/letters', 'alice', { requestId: id, destinationType: 'FRIEND', type: 'VOICE', presetId: 'preset_lantern', recipientId: 'owner-bob', voiceAssetId: grant.assetId, deliveryConfirmed: true }); assert.equal((await privateTry.json() as { reason: string }).reason, 'VOICE_UNAVAILABLE'); assert.equal(context.fixture.state.voiceAssets[0]!.status, 'READY');
  const published = await (await request('/letters', 'alice', { requestId: id, destinationType: 'INFINITY', type: 'VOICE', presetId: 'preset_lantern', voiceAssetId: grant.assetId, isSigned: false, publicConfirmed: true })).json() as WorldReceipt; assert.equal(published.outcome, 'DELIVERED');
  const opened = await (await request(`/infinity/stars/${published.letterId}/open`, 'carol')).json() as WorldLetter; assert.equal(opened.signature, null); assert.equal(opened.type, 'VOICE'); assert.ok(opened.audio?.url); assert.ok(!JSON.stringify(opened).includes('owner-alice'));
  await request(`/infinity/stars/${published.letterId}/delete`, 'alice', { confirmed: true }); await context.voiceAssets.cleanup(); assert.equal(storage.objects.has('voice/sealed/' + grant.assetId), false);
});
