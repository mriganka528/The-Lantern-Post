import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BurnReceipt, LetterPreset, VoiceClip } from '@lantern-post/shared-types';
import { DraftController, decodeDraft, newDraft } from '../src/letters/draft';
import { RecorderController } from '../src/voice/recorder-controller';
import type { VoiceCapture, VoiceRecording, VoiceStore } from '../src/voice/voice-contract';
const clip: VoiceClip = { id: '70000000-0000-4000-8000-000000000001', mimeType: 'audio/webm', byteLength: 100, durationMs: 2000 };
const requestId = '70000000-0000-4000-8000-000000000002';
const recording: VoiceRecording = { bytes: new Uint8Array(100), mimeType: 'audio/webm', durationMs: 2000 };
const preset: LetterPreset = { id: 'preset_voice', key: 'ivory', displayName: 'Ivory', description: 'Antique paper', config: { paperColor: '#F0DDB5', inkColor: '#493622', sealColor: '#874B36', ribbonColor: '#899069', texture: 'parchment', motif: 'royal', font: 'book' } };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  let raw: string | null = null; let fail = false;
  const storage = { read: () => raw, write: (_: string, value: string) => { if (fail) throw new Error('Full disk'); raw = value; } };
  const draft = new DraftController('owner-a', storage); draft.openDesk(); draft.choosePreset(preset); draft.changeKind('VOICE');
  return { draft, storage, fail: (value: boolean) => { fail = value; } };
}
function recorderFixture() {
  const entries = new Map<string, VoiceRecording>(); const calls: string[] = [];
  const store: VoiceStore = { save: async (owner, value, bytes) => { calls.push('save:' + owner); entries.set(value.id, { ...value, bytes }); }, remove: async (owner, id) => { calls.push('remove:' + owner); entries.delete(id); }, read: async (_owner, value) => entries.get(value.id)!.bytes, playback: async () => ({ uri: 'synthetic', release: () => {} }), sha256: async () => 'synthetic' };
  const capture: VoiceCapture = { stop: async () => recording, cancel: () => { calls.push('cancel'); } };
  return { store, capture, entries, calls };
}
test('recording persists bytes before attachment and releases the microphone after saving', async () => {
  const f = recorderFixture(); const draft = fixture().draft;
  const recorder = new RecorderController({ available: () => true, start: async () => f.capture }, f.store, 'owner-a', value => { assert.ok(f.entries.has(value.id)); return draft.attachVoice(value); }, () => clip.id);
  try { await recorder.start(); await recorder.stop(); assert.deepEqual(draft.getSnapshot().draft!.voice, clip); assert.equal(recorder.getSnapshot().phase, 'idle'); assert.deepEqual(f.calls, ['save:owner-a', 'cancel']); }
  finally { recorder.dispose(); }
});
test('leaving during microphone permission cancels the late capture without saving another account\'s draft', async () => {
  const f = recorderFixture(); const gate = deferred<VoiceCapture>(); let signal: AbortSignal | undefined; let attached = false;
  const recorder = new RecorderController({ available: () => true, start: async (_meter, _ended, current) => { signal = current; return gate.promise; } }, f.store, 'owner-a', () => { attached = true; return true; }, () => clip.id);
  const pending = recorder.start(); recorder.dispose(); assert.equal(signal!.aborted, true); gate.resolve(f.capture); await pending;
  assert.equal(attached, false); assert.deepEqual(f.calls, ['cancel']); assert.equal(f.entries.size, 0);
});

test('backgrounding during permission prevents a late microphone capture from starting or saving', async () => {
  const f = recorderFixture(); const gate = deferred<VoiceCapture>(); let signal: AbortSignal | undefined;
  const recorder = new RecorderController({ available: () => true, start: async (_meter, _ended, current) => { signal = current; return gate.promise; } }, f.store, 'owner-a', () => { throw Error('A background capture must not attach'); }, () => clip.id);
  const pending = recorder.start(); recorder.background(); assert.equal(signal?.aborted, true); gate.resolve(f.capture); await pending;
  assert.equal(recorder.getSnapshot().phase, 'idle'); assert.equal(f.entries.size, 0); assert.deepEqual(f.calls, ['cancel']); recorder.dispose();
});
test('leaving during a disk save removes the unattached recording and never attaches after unmount', async () => {
  const f = recorderFixture(); const saving = deferred<void>(); const started = deferred<void>(); const save = f.store.save; let attached = false;
  f.store.save = async (...args) => { await save(...args); started.resolve(); await saving.promise; };
  const recorder = new RecorderController({ available: () => true, start: async () => f.capture }, f.store, 'owner-a', () => { attached = true; return true; }, () => clip.id);
  await recorder.start(); const stopping = recorder.stop(); await started.promise; recorder.dispose(); saving.resolve(); await stopping;
  assert.equal(attached, false); assert.equal(f.entries.size, 0); assert.ok(f.calls.includes('remove:owner-a'));
});
test('failed or stale draft attachment removes its take instead of replacing the newer page', async () => {
  for (const partialFailure of [false, true]) {
    const f = recorderFixture(); if (partialFailure) { const save = f.store.save; f.store.save = async (...args) => { await save(...args); throw new Error('Interrupted write'); }; }
    const recorder = new RecorderController({ available: () => true, start: async () => f.capture }, f.store, 'owner-a', () => false, () => clip.id);
    try { await recorder.start(); await recorder.stop(); assert.equal(f.entries.size, 0); assert.equal(recorder.getSnapshot().phase, 'error'); assert.ok(f.calls.includes('remove:owner-a')); }
    finally { recorder.dispose(); }
  }
});
test('confirmed voice burning retains a durable deletion queue before the next page can open', () => {
  const f = fixture(); f.draft.attachVoice(clip); f.draft.seal(); f.draft.beginBurn(requestId);
  const intent = f.draft.pendingBurn()!; assert.equal(intent.type, 'VOICE'); assert.equal('voice' in intent, false); assert.equal('audioUrl' in intent, false);
  const receipt: BurnReceipt = { requestId, receiptId: `burn_${'a'.repeat(64)}`, outcome: 'BURNED', reason: null, completedAt: new Date().toISOString() };
  f.draft.applyBurnReceipt(receipt); assert.equal(f.draft.getSnapshot().draft!.voice, null); assert.deepEqual(f.draft.getSnapshot().draft!.voiceDeletes, [clip.id]); assert.equal(f.draft.reset(), false);
  const reopened = new DraftController('owner-a', f.storage); reopened.openDesk(); assert.equal(reopened.getSnapshot().draft!.stage, 'burned');
  f.fail(true); assert.equal(reopened.finishVoiceDelete(clip.id), false); assert.equal(reopened.reset(), false);
  f.fail(false); assert.equal(reopened.finishVoiceDelete(clip.id), true); assert.equal(reopened.getSnapshot().draft!.stage, 'writing'); assert.deepEqual(reopened.getSnapshot().draft!.voiceDeletes, []);
});
test('a declined voice delivery keeps the recording; removing it fences sealing and recording until cleanup', () => {
  const f = fixture(); f.draft.attachVoice(clip); f.draft.seal(); f.draft.beginDelivery(requestId, { id: 'owner-b', username: 'bob', characterKey: 'fox-lantern', palaceName: 'Ivory Court' });
  assert.equal(f.draft.applyDeliveryReceipt({ requestId, receiptId: `delivery_${'b'.repeat(64)}`, recipientId: 'owner-b', outcome: 'REJECTED', letterId: null, reason: 'CONTENT_NOT_ALLOWED', completedAt: new Date().toISOString() }), true);
  assert.deepEqual(f.draft.getSnapshot().draft!.voice, clip); assert.deepEqual(f.draft.getSnapshot().draft!.voiceDeletes, []);
  f.draft.unseal(); assert.equal(f.draft.discardVoice(), true); assert.equal(f.draft.attachVoice(clip), false); assert.equal(f.draft.seal(), false);
  f.draft.finishVoiceDelete(clip.id); assert.equal(f.draft.attachVoice(clip), true);
});
test('draft migration preserves old text and rejects mixed or overlapping voice content', () => {
  const legacy = { ...newDraft('owner-a'), version: 3, text: 'An old palace letter' }; delete (legacy as Record<string, unknown>).kind; delete (legacy as Record<string, unknown>).voice; delete (legacy as Record<string, unknown>).voiceDeletes;
  const migrated = decodeDraft(JSON.stringify(legacy), 'owner-a'); assert.equal(migrated.text, legacy.text); assert.equal(migrated.kind, 'TEXT'); assert.equal(migrated.version, 6);
  assert.throws(() => decodeDraft(JSON.stringify({ ...newDraft('owner-a'), voice: clip }), 'owner-a'));
  assert.throws(() => decodeDraft(JSON.stringify({ ...newDraft('owner-a'), kind: 'VOICE', voice: clip, voiceDeletes: [clip.id] }), 'owner-a'));
});
