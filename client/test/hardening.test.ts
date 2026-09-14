import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LetterPreset } from '@lantern-post/shared-types';
import { CHARACTER_KEYS } from '../src/storybook/character-keys';
import { RecoveryScheduler } from '../src/letters/recovery-scheduler';
import { mightNeedSupport } from '../src/safety/support-resources';
import { DraftController, decodeDraft, newDraft } from '../src/letters/draft';
import { cleanRecipient } from '../src/letters/delivery-contract';
const preset: LetterPreset = { id: 'royal-page', key: 'royal-moonlace', displayName: 'Royal Moonlace', description: 'An opal page.', collection: 'royal', config: { paperColor: '#F1E5C8', inkColor: '#493B3E', sealColor: '#87708A', ribbonColor: '#978AA4', texture: 'vellum', motif: 'lace', font: 'script' } };
const clip = { id: 'a0000000-0000-4000-8000-000000000001', mimeType: 'audio/webm' as const, byteLength: 100, durationMs: 2000 }; const requestId = 'a0000000-0000-4000-8000-000000000002';
function fixture() { let raw: string | null = null; const draft = new DraftController('owner-a', { read: () => raw, write: (_key, value) => { raw = value; } }); draft.openDesk(); draft.choosePreset(preset); return { draft, raw: () => raw }; }
test('foreground recovery checks a receipt first and never retries a resolved or unconfirmed page', async () => {
  let id: string | null = 'confirmed'; let retries = 0; const queue = new RecoveryScheduler({ identity: () => id, busy: () => false, check: async () => { id = null; }, permitted: async () => true, retry: async () => { retries++; } });
  await queue.resume(); assert.equal(retries, 0); await queue.resume(); assert.equal(retries, 0);
});
test('foreground recovery shares a running attempt and waits for capability approval', async () => {
  let release!: () => void; let retries = 0; let permitted = false; let checks = 0;
  const queue = new RecoveryScheduler({ identity: () => 'confirmed', busy: () => false, check: async () => { checks++; if (checks === 1) await new Promise<void>(done => { release = done; }); }, permitted: async () => permitted, retry: async () => { retries++; } });
  const running = queue.resume(); await queue.resume(); release(); await running; assert.equal(checks, 1); assert.equal(retries, 0); permitted = true; await queue.resume(); assert.equal(retries, 1);
});
test('leaving or changing the saved intent while a capability check is pending cancels automatic transmission', async () => {
  for (const stop of [true, false]) { let id = 'owner-a:confirmed'; let release!: (value: boolean) => void; let retries = 0;
    const queue = new RecoveryScheduler({ identity: () => id, busy: () => false, check: async () => {}, permitted: async () => new Promise<boolean>(done => { release = done; }), retry: async () => { retries++; } }); const pending = queue.resume(); await Promise.resolve(); if (stop) queue.stop(); else id = 'owner-b:other'; release(true); await pending; assert.equal(retries, 0);
  }
});
test('royal stationery and all new companion keys survive trusted draft/recipient decoding', () => {
  const f = fixture(); f.draft.edit('A little royal letter.'); f.draft.seal(); const restored = decodeDraft(f.raw(), 'owner-a'); assert.equal(restored.preset!.collection, 'royal'); assert.equal(restored.preset!.config.motif, 'lace');
  for (const key of CHARACTER_KEYS) assert.equal(cleanRecipient({ id: 'other', username: 'friend', palaceName: 'A palace', characterKey: key })?.characterKey, key);
});
test('voice captions are local draft content, preserved on rejection and cleared by confirmed burns without uploading them', () => {
  const f = fixture(); f.draft.changeKind('VOICE'); f.draft.attachVoice(clip); f.draft.editVoiceCaption('Words for someone who cannot listen.'); f.draft.seal(); f.draft.beginWorld(requestId);
  assert.equal(f.draft.pendingWorld()!.type, 'VOICE'); f.draft.applyWorldReceipt({ requestId, receiptId: `world_${'a'.repeat(64)}`, isSigned: false, outcome: 'REJECTED', reason: 'CANCELLED', letterId: null, completedAt: new Date().toISOString() }); assert.ok(f.draft.getSnapshot().draft!.voiceCaption);
  f.draft.beginBurn(requestId); assert.equal('voiceCaption' in f.draft.pendingBurn()!, false); f.draft.editVoiceCaption('Cannot edit pending'); assert.notEqual(f.draft.getSnapshot().draft!.voiceCaption, 'Cannot edit pending');
  f.draft.applyBurnReceipt({ requestId, receiptId: `burn_${'a'.repeat(64)}`, outcome: 'BURNED', reason: null, completedAt: new Date().toISOString() }); assert.equal(f.draft.getSnapshot().draft!.voiceCaption, ''); assert.ok(!f.raw()!.includes('cannot listen'));
});
test('legacy v5 drafts migrate without invented captions and support suggestions never become stored diagnosis flags', () => {
  const old = { ...newDraft('owner-a'), version: 5, text: 'I want to die' }; delete (old as Record<string, unknown>).voiceCaption;
  const current = decodeDraft(JSON.stringify(old), 'owner-a'); assert.equal(current.version, 6); assert.equal(current.voiceCaption, ''); assert.equal(mightNeedSupport(current.text), true); assert.equal(mightNeedSupport('The moonflowers look beautiful today.'), false); assert.ok(!JSON.stringify(current).includes('supportSuggested'));
});
