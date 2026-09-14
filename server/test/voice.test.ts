import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import type { DeliveryReceipt, FriendVoiceLetterRequest, OpenedFriendLetter, VoiceUploadGrant, VoiceUploadRequest } from '@lantern-post/shared-types';
import { inspectVoice } from '../src/voice/audio-validation';
import { signObjectUrl } from '../src/voice/s3-signing';
import { createFriendsTestApp } from './friends-fixture';
import { memoryVoiceStorage, syntheticM4a, syntheticWebm } from './voice-fixture';
let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
const media = memoryVoiceStorage(); let approval: 'APPROVED' | 'REJECTED' = 'APPROVED'; let voiceChecks = 0;
before(async () => { context = await createFriendsTestApp(false, { available: true, voiceAvailable: true, check: async () => 'APPROVED', checkVoice: async ({ bytes }) => { voiceChecks++; assert.ok(bytes.length >= 64); return approval; } }, media.storage); });
beforeEach(() => { context.fixture.reset(); media.objects.clear(); media.calls.length = 0; media.setDeleteFailure(false); media.setEnabled(true); media.setBeforePut(null); voiceChecks = 0; approval = 'APPROVED';
  context.fixture.state.requests.push({ id: 'accepted_ab', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date(), respondedAt: new Date() });
});
after(async () => context?.app.close());
const request = (path: string, who = 'alice', body?: unknown, post = true) => fetch(`${context.url}${path}`, { method: post ? 'POST' : 'GET', headers: { ...(who ? { Authorization: `Bearer ${who}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
function uploadBody(bytes = syntheticWebm()): VoiceUploadRequest { return { requestId: randomUUID(), recipientId: 'owner-bob', mimeType: 'audio/webm', byteLength: bytes.length, durationMs: 2000, sha256: createHash('sha256').update(bytes).digest('base64') }; }
async function prepare() {
  const bytes = syntheticWebm(); const body = uploadBody(bytes); const response = await request('/voice/uploads', 'alice', body); assert.equal(response.status, 200);
  const grant = await response.json() as VoiceUploadGrant; media.objects.set(`voice/incoming/${grant.assetId}`, bytes);
  assert.equal((await request(`/voice/uploads/${grant.assetId}/finish`)).status, 200);
  const letter: FriendVoiceLetterRequest = { requestId: body.requestId, type: 'VOICE', destinationType: 'FRIEND', recipientId: body.recipientId, presetId: 'preset_lantern', deliveryConfirmed: true, voiceAssetId: grant.assetId };
  return { bytes, body, grant, letter };
}

test('audio timing is read from actual WebM packets and AAC sample tables, rejecting empty, truncated or long media', () => {
  assert.equal(inspectVoice(syntheticWebm(), 'audio/webm'), 2000); assert.equal(inspectVoice(syntheticM4a(), 'audio/mp4'), 2000);
  assert.throws(() => inspectVoice(Buffer.alloc(256), 'audio/webm'));
  assert.throws(() => inspectVoice(syntheticWebm().subarray(0, 80), 'audio/webm'));
  assert.throws(() => inspectVoice(syntheticWebm(181000), 'audio/webm'));
  assert.throws(() => inspectVoice(syntheticM4a().subarray(0, 90), 'audio/mp4'));
  const video = Buffer.from(syntheticM4a()); video.write('vide', video.indexOf(Buffer.from('soun'))); assert.throws(() => inspectVoice(video, 'audio/mp4'));
});
test('signed object grants bind their method, key, length and MIME without exposing the signing secret', () => {
  const settings = { endpoint: 'https://objects.example.invalid', bucket: 'lantern-test', region: 'auto', accessKeyId: 'PUBLIC_TEST_ID', secretAccessKey: 'private-test-signing-key' };
  const key = `voice/incoming/voice_${'a'.repeat(64)}`; const now = new Date('2026-09-13T00:00:00Z');
  const put = signObjectUrl(settings, 'PUT', key, 600, now, { 'content-length': '1024', 'content-type': 'audio/webm' });
  assert.equal(new URL(put).searchParams.get('X-Amz-SignedHeaders'), 'content-length;content-type;host'); assert.ok(!put.includes(settings.secretAccessKey));
  assert.notEqual(put, signObjectUrl(settings, 'PUT', key, 600, now, { 'content-length': '2048', 'content-type': 'audio/webm' }));
  assert.notEqual(put, signObjectUrl(settings, 'GET', key, 600, now)); assert.notEqual(put, signObjectUrl(settings, 'PUT', key.replace('/incoming/', '/sealed/'), 600, now));
  assert.throws(() => signObjectUrl(settings, 'GET', '../server/.env', 600, now)); assert.throws(() => signObjectUrl(settings, 'GET', key, 901, now));
});
test('voice upload routes authenticate, validate bounds and reject caller-selected object URLs/owners', async () => {
  const body = uploadBody(); assert.equal((await request('/voice/uploads', '', body)).status, 401);
  assert.equal((await request('/voice/uploads/voice_bad/finish', '')).status, 401);
  for (const invalid of [{ ...body, byteLength: 9_000_000 }, { ...body, durationMs: 180001 }, { ...body, mimeType: 'video/mp4' }, { ...body, sha256: 'bad' }, { ...body, ownerId: 'owner-bob' }, { ...body, audioUrl: 'https://untrusted.test' }]) assert.equal((await request('/voice/uploads', 'alice', invalid)).status, 400);
  assert.equal(context.fixture.state.voiceAssets.length, 0);
});
test('voice uploads require a current friend and stay private until verified and moderated', async () => {
  assert.equal((await request('/voice/uploads', 'alice', { ...uploadBody(), recipientId: 'owner-carol' })).status, 404);
  const prepared = await prepare(); assert.equal(context.fixture.state.voiceAssets[0]!.status, 'READY'); assert.equal(context.fixture.state.letters.length, 0);
  assert.ok(media.objects.has(`voice/sealed/${prepared.grant.assetId}`));
  const delivered = await (await request('/letters', 'alice', prepared.letter)).json() as DeliveryReceipt; assert.equal(delivered.outcome, 'DELIVERED'); assert.equal(voiceChecks, 1);
  assert.equal(context.fixture.state.voiceAssets[0]!.status, 'ATTACHED'); assert.equal(context.fixture.state.letters[0]!.textContent, null); assert.equal(context.fixture.state.letters[0]!.audioUrl, null);
  const opened = await (await request(`/letters/friends/${delivered.letterId}/open`, 'bob')).json() as OpenedFriendLetter; assert.equal(opened.type, 'VOICE'); assert.ok(opened.audio?.url.includes('/sealed/')); assert.equal(opened.audio?.durationMs, 2000);
  assert.equal((await request(`/letters/friends/${delivered.letterId}/open`, 'carol')).status, 404);
});
test('upload grants and assets cannot be borrowed by another owner or retargeted', async () => {
  const prepared = await prepare(); assert.equal((await request(`/voice/uploads/${prepared.grant.assetId}/finish`, 'bob')).status, 404);
  const replay = await (await request('/voice/uploads', 'alice', prepared.body)).json() as VoiceUploadGrant; assert.equal(replay.assetId, prepared.grant.assetId); assert.equal(replay.uploadUrl, null);
  assert.equal((await request('/voice/uploads', 'alice', { ...prepared.body, sha256: createHash('sha256').update('different').digest('base64') })).status, 409);
  const stolen = await (await request('/letters', 'bob', { ...prepared.letter, recipientId: 'owner-alice' })).json() as DeliveryReceipt; assert.equal(stolen.reason, 'VOICE_UNAVAILABLE'); assert.equal(context.fixture.state.voiceAssets[0]!.status, 'READY');
});
test('a replayed incoming PUT cannot change the checked object used for delivery', async () => {
  const prepared = await prepare(); media.objects.set(`voice/incoming/${prepared.grant.assetId}`, Buffer.alloc(prepared.bytes.length, 0));
  const result = await (await request('/letters', 'alice', prepared.letter)).json() as DeliveryReceipt; assert.equal(result.outcome, 'DELIVERED');
  assert.deepEqual(Buffer.from(media.objects.get(`voice/sealed/${prepared.grant.assetId}`)!), prepared.bytes);
});
test('bad bytes or false timing are rejected before becoming an attachable voice asset', async () => {
  const body = uploadBody(); const grant = await (await request('/voice/uploads', 'alice', body)).json() as VoiceUploadGrant;
  media.objects.set(`voice/incoming/${grant.assetId}`, Buffer.alloc(body.byteLength, 0)); assert.equal((await request(`/voice/uploads/${grant.assetId}/finish`)).status, 409);
  assert.equal(context.fixture.state.voiceAssets[0]!.status, 'DELETED'); assert.equal(context.fixture.state.voiceAssets[0]!.sha256, null); assert.equal(context.fixture.state.letters.length, 0);
});
test('rejected speech gets a durable rejection and queues its private objects for cleanup', async () => {
  const prepared = await prepare(); approval = 'REJECTED'; const rejection = await (await request('/letters', 'alice', prepared.letter)).json() as DeliveryReceipt;
  assert.equal(rejection.reason, 'CONTENT_NOT_ALLOWED'); assert.equal(context.fixture.state.letters.length, 0); assert.equal(context.fixture.state.voiceAssets[0]!.status, 'DELETED');
  approval = 'APPROVED'; assert.deepEqual(await (await request('/letters', 'alice', prepared.letter)).json(), rejection);
  await context.voiceAssets.cleanup(); assert.equal(media.objects.has(`voice/sealed/${prepared.grant.assetId}`), false);
  assert.equal(media.objects.has(`voice/incoming/${prepared.grant.assetId}`), true, 'An incoming URL may still be valid until expiry.');
});
test('cancellation during promotion cannot publish or strand a late private copy', async () => {
  const bytes = syntheticWebm(); const body = uploadBody(bytes); const grant = await (await request('/voice/uploads', 'alice', body)).json() as VoiceUploadGrant; media.objects.set(`voice/incoming/${grant.assetId}`, bytes);
  media.setBeforePut(async () => { await request(`/letters/friends/requests/${body.requestId}/cancel`, 'alice', { recipientId: body.recipientId }); await context.voiceAssets.cleanup(); });
  assert.equal((await request(`/voice/uploads/${grant.assetId}/finish`)).status, 409);
  assert.equal(context.fixture.state.voiceAssets[0]!.contentClearedAt, null); await context.voiceAssets.cleanup(); assert.equal(media.objects.has(`voice/sealed/${grant.assetId}`), false);
});
test('deleting voice letters revokes new playback and retries failed object cleanup', async () => {
  const prepared = await prepare(); const delivered = await (await request('/letters', 'alice', prepared.letter)).json() as DeliveryReceipt;
  assert.equal((await request(`/letters/friends/${delivered.letterId}/delete`, 'bob')).status, 200);
  assert.equal((await request(`/letters/friends/${delivered.letterId}/open`, 'bob')).status, 404);
  assert.equal((await request(`/letters/friends/${delivered.letterId}/open`, 'alice')).status,200);await context.voiceAssets.cleanup();assert.equal(context.fixture.state.voiceAssets[0]!.status,'ATTACHED');
  assert.equal((await request(`/letters/friends/${delivered.letterId}/delete`, 'alice')).status,200);
  media.setDeleteFailure(true); await context.voiceAssets.cleanup(); assert.equal(context.fixture.state.voiceAssets[0]!.contentClearedAt, null);
  media.setDeleteFailure(false); await context.voiceAssets.cleanup(); assert.ok(context.fixture.state.voiceAssets[0]!.contentClearedAt);
  assert.deepEqual(await (await request('/letters', 'alice', prepared.letter)).json(), delivered);
});
test('burning a voice letter creates no audio object, URL, duration or retained recording on the server', async () => {
  const body = { requestId: randomUUID(), type: 'VOICE', destinationType: 'BURNING', presetId: 'preset_lantern', burnConfirmed: true, audioMimeType: 'audio/webm', audioByteLength: 500, audioDurationMs: 2000 };
  assert.equal((await request('/letters', 'alice', body)).status, 200);
  assert.equal(context.fixture.state.voiceAssets.length, 0); assert.equal(media.calls.length, 0);
  const row = context.fixture.state.letters[0]!; assert.equal(row.type, 'VOICE'); assert.equal(row.status, 'HARD_DELETED'); assert.equal(row.audioUrl, null); assert.equal(row.audioDurationMs, null);
  assert.equal((await request('/letters', 'alice', { ...body, audioUrl: 'https://untrusted.test' })).status, 400);
});
