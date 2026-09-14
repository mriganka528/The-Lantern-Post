import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import type { LetterPreset, VoiceUploadGrant, WorldLetter, WorldReceipt } from '@lantern-post/shared-types';
import { createFriendsTestApp } from './friends-fixture';
import { royalFixtures } from './royal-fixture';
import { memoryVoiceStorage, syntheticWebm } from './voice-fixture';
import { DiagnosticsService } from '../src/diagnostics/diagnostics.service';
import { sentryEnvelope, sentrySettings, summarizeDiagnostics } from '../src/diagnostics/diagnostics-contract';
import { RetentionService } from '../src/retention/retention.service';
import type { PrismaService } from '../src/database/prisma.service';
import type { Environment } from '../src/config/environment';
const media = memoryVoiceStorage(); let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
before(async () => { context = await createFriendsTestApp(false, { available: true, voiceAvailable: true, check: async text => text.includes('blocked-caption') ? 'REJECTED' : 'APPROVED', checkVoice: async () => 'APPROVED' }, media.storage); });
beforeEach(() => { context.fixture.reset(); media.objects.clear(); media.calls.length = 0; const royal = royalFixtures(); context.fixture.state.characters.push(...royal.characters); context.fixture.state.presets.push(...royal.presets); });
after(async () => context?.app.close());
const request = (path: string, who = 'alice', body?: unknown, method = 'POST') => fetch(context.url + path, { method, headers: { ...(who ? { Authorization: `Bearer ${who}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const event = (name = 'SESSION_OPEN') => ({ eventId: randomUUID(), name, platform: 'web' });

test('all four royal companions and six ornate presets are active and freely usable without an entitlement', async () => {
  const royal = royalFixtures(); assert.equal(royal.characters.length, 4); assert.equal(royal.presets.length, 6);
  const catalog = await (await request('/characters', 'alice', undefined, 'GET')).json() as { characters: { id: string; collection?: string }[] }; assert.equal(catalog.characters.filter(c => c.collection === 'royal').length, 4);
  for (const c of royal.characters) { assert.equal((await request('/users/me/character', 'alice', { characterId: c.id })).status, 200); assert.equal(context.fixture.state.users[0]!.characterId, c.id); }
  const presets = await (await request('/presets', 'alice', undefined, 'GET')).json() as { presets: LetterPreset[] }; assert.equal(presets.presets.filter(p => p.collection === 'royal').length, 6);
  for (const p of royal.presets) { const sent = await request('/letters', 'alice', { requestId: randomUUID(), type: 'TEXT', destinationType: 'BURNING', textContent: 'A synthetic royal page.', presetId: p.id, burnConfirmed: true }); assert.equal(sent.status, 200); }
});
test('diagnostics require authentication, default off, reject content payloads, deduplicate and erase on opt-out', async () => {
  assert.equal((await request('/diagnostics/preferences', '', undefined, 'GET')).status, 401); assert.equal(context.fixture.state.calls, 0);
  assert.deepEqual(await (await request('/diagnostics/preferences', 'alice', undefined, 'GET')).json(), { enabled: false }); assert.deepEqual(await (await request('/diagnostics/events', 'alice', event())).json(), { accepted: false }); assert.equal(context.fixture.state.diagnostics.length, 0);
  await request('/diagnostics/preferences', 'alice', { enabled: true }); const item = event(); assert.equal((await request('/diagnostics/events', 'alice', { ...item, textContent: 'private words' })).status, 400); assert.equal((await request('/diagnostics/events', 'alice', { ...item, actorKey: 'forged' })).status, 400);
  await request('/diagnostics/events', 'alice', item); await request('/diagnostics/events', 'alice', { ...item, eventId: item.eventId.toUpperCase() }); assert.equal(context.fixture.state.diagnostics.length, 1); assert.ok(!JSON.stringify(context.fixture.state.diagnostics).includes('owner-alice'));
  await request('/diagnostics/preferences', 'bob', { enabled: false }); assert.equal(context.fixture.state.diagnostics.length, 1); await request('/diagnostics/preferences', 'alice', { enabled: false }); assert.equal(context.fixture.state.diagnostics.length, 0); assert.equal(context.fixture.state.users[0]!.diagnosticsKey, null);
});
test('confirmed-send analytics require the current owner’s receipt and cannot collect pre-consent history', async () => {
  const id = randomUUID(); const body = { requestId: id, type: 'TEXT', destinationType: 'BURNING', textContent: 'Private words', presetId: 'preset_lantern', burnConfirmed: true }; await request('/letters', 'alice', body);
  await request('/diagnostics/preferences', 'alice', { enabled: true }); const input = { ...event('BURN_COMPLETED'), requestId: id };
  // Make the consent boundary explicit even on a fast millisecond clock.
  context.fixture.state.users[0]!.diagnosticsSince = new Date(Date.now() + 1);
  assert.deepEqual(await (await request('/diagnostics/events', 'alice', input)).json(), { accepted: false }); context.fixture.state.users[0]!.diagnosticsSince = new Date(Date.now() - 10000);
  await request('/diagnostics/events', 'alice', input); assert.equal(context.fixture.state.diagnostics.length, 1);
  await request('/diagnostics/preferences', 'bob', { enabled: true }); assert.deepEqual(await (await request('/diagnostics/events', 'bob', input)).json(), { accepted: false }); assert.equal(context.fixture.state.diagnostics.length, 1);
});
test('Sentry forwarding contains only fixed error codes and never actors, messages, stacks, links or letter content', async () => {
  const settings = sentrySettings('https://testkey@ingest.example.invalid/42'); assert.equal(settings.endpoint, 'https://ingest.example.invalid/api/42/envelope/');
  assert.throws(() => sentrySettings('https://secret:password@example.invalid/42'), error => error instanceof Error && !error.message.includes('password'));
  const raw = sentryEnvelope({ id: 'diag_' + 'a'.repeat(64), platform: 'web', code: 'RENDER_ERROR', occurredAt: new Date() }); assert.ok(!raw.includes('actorKey')); assert.ok(!raw.includes('stacktrace'));
  await request('/diagnostics/preferences', 'alice', { enabled: true }); await request('/diagnostics/events', 'alice', { ...event('CLIENT_ERROR'), code: 'RENDER_ERROR' });
  const original = global.fetch; const sent: string[] = []; global.fetch = async (url, init) => { if (String(url) === settings.endpoint) { sent.push(String(init?.body)); return new Response('', { status: 200 }); } return original(url, init); };
  try { const service = new DiagnosticsService(context.fixture.database as unknown as PrismaService, new ConfigService({ DIAGNOSTICS_SENTRY: settings }) as ConfigService<Environment, true>); await service.flush(); assert.equal(sent.length, 1); const body = sent[0]!; for (const privateValue of ['alice', 'owner-alice', String(context.fixture.state.users[0]!.diagnosticsKey), 'textContent', 'Authorization', 'stacktrace']) assert.ok(!body.includes(privateValue)); await service.flush(); assert.equal(sent.length, 1); }
  finally { global.fetch = original; }
});
test('aggregate diagnostics calculate eligible D1/D7 cohorts and first confirmed sends without exposing actor keys', () => {
  const base = Date.parse('2026-01-01T00:00:00Z'); const row = (actorKey: string, name: string, ms: number) => ({ actorKey, name, occurredAt: new Date(base + ms) });
  const stats = summarizeDiagnostics([row('opaque-a','SESSION_OPEN',0), row('opaque-a','SESSION_OPEN',86400000+1), row('opaque-a','SESSION_OPEN',7*86400000+1), row('opaque-a','BURN_COMPLETED',120000), row('opaque-b','SESSION_OPEN',0)], new Date(base+9*86400000));
  assert.deepEqual(stats.d1, { eligible: 2, returned: 1 }); assert.deepEqual(stats.d7, { eligible: 2, returned: 1 }); assert.equal(stats.medianSecondsToFirstConfirmedSend, 120); assert.ok(!JSON.stringify(stats).includes('opaque-a'));
});
async function voice(caption: string) {
  const bytes = syntheticWebm(); const id = randomUUID(); const grant = await (await request('/voice/uploads', 'alice', { requestId: id, destinationType: 'INFINITY', mimeType: 'audio/webm', byteLength: bytes.length, durationMs: 2000, sha256: createHash('sha256').update(bytes).digest('base64') })).json() as VoiceUploadGrant;
  media.objects.set(`voice/incoming/${grant.assetId}`, bytes); assert.equal((await request(`/voice/uploads/${grant.assetId}/finish`)).status, 200);
  const response = await request('/letters', 'alice', { requestId: id, destinationType: 'INFINITY', type: 'VOICE', presetId: 'preset_lantern', voiceAssetId: grant.assetId, voiceCaption: caption, isSigned: false, publicConfirmed: true }); return { response, grant };
}
test('written voice captions are moderated separately, appear only on opening, and disappear on removal', async () => {
  const rejected = await voice('blocked-caption'); assert.equal((await rejected.response.json() as WorldReceipt).reason, 'CONTENT_NOT_ALLOWED'); assert.equal(context.fixture.state.letters.length, 0);
  const kept = await voice('Words for someone who cannot listen.'); const receipt = await kept.response.json() as WorldReceipt; assert.equal(receipt.outcome, 'DELIVERED');
  const list = await (await request('/infinity/stars?minX=0&maxX=1600&minY=0&maxY=1000', 'bob', undefined, 'GET')).text(); assert.ok(!list.includes('cannot listen'));
  const opened = await (await request(`/infinity/stars/${receipt.letterId}/open`, 'bob')).json() as WorldLetter; assert.equal(opened.audio?.caption, 'Words for someone who cannot listen.');
  await request(`/infinity/stars/${receipt.letterId}/delete`, 'alice', { confirmed: true }); assert.equal(context.fixture.state.letters[0]!.voiceCaption, null);
});
test('retention clears due content and voice captions, retains report stubs and never removes operation receipts', async () => {
  const { response, grant } = await voice('Temporary words to clear.'); const receipt = await response.json() as WorldReceipt; const row = context.fixture.state.letters[0]!; const now = new Date();
  row.status = 'SOFT_DELETED'; row.hardDeleteAfter = new Date(now.getTime()-1000); const retainedReceipt = { ...context.fixture.state.worldReceipts[0] };
  const service = context.app.get(RetentionService); await service.sweep(now); assert.equal(row.textContent, null); assert.equal(row.voiceCaption, null); assert.equal(row.voiceAssetId, null); assert.equal(row.status, 'HARD_DELETED'); assert.equal(context.fixture.state.voiceAssets.find(a=>a.id===grant.assetId)!.status, 'DELETED');
  row.hardDeleteAfter = new Date(now.getTime()-31*86400000); context.fixture.state.reports.push({ id: 'report_fixture', letterId: receipt.letterId, reporterId: 'owner-bob', reportedUserId: 'owner-alice', reason: 'OTHER', status: 'OPEN' });
  await service.sweep(now); assert.equal(context.fixture.state.letters.length, 1); context.fixture.state.reports = []; await service.sweep(now); assert.equal(context.fixture.state.letters.length, 0); assert.deepEqual(context.fixture.state.worldReceipts[0], retainedReceipt);
});
