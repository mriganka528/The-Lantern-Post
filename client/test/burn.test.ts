import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BurnLetterRequest, BurnReceipt, LetterPreset } from '@lantern-post/shared-types';
import { BurnController } from '../src/letters/burn-controller';
import type { BurnTransport } from '../src/letters/burn-controller';
import { decodeDraft, DraftController, newDraft } from '../src/letters/draft';
import type { DraftStorage } from '../src/letters/draft';

const requestId = '30000000-0000-4000-8000-000000000001';
const nextId = '30000000-0000-4000-8000-000000000002';
const words = 'A private thought to let go of.';
const preset: LetterPreset = { id: 'preset_lantern', key: 'lantern-parchment', displayName: 'Lantern parchment', description: 'A warm page.', config: { paperColor: '#F0DDB5', inkColor: '#493622', sealColor: '#874B36', ribbonColor: '#899069', texture: 'parchment', motif: 'postmark', font: 'book' } };
const receipt = (id = requestId, outcome: BurnReceipt['outcome'] = 'BURNED'): BurnReceipt => ({ requestId: id, receiptId: `burn_${'a'.repeat(64)}`, outcome, reason: outcome === 'BURNED' ? null : 'PRESET_UNAVAILABLE', completedAt: '2026-09-12T00:00:00.000Z' });
function fixture() {
  let fail = false;
  const values = new Map<string, string>();
  const storage: DraftStorage = { read: key => values.get(key) ?? null, write: (key, value) => { if (fail) throw new Error('Storage unavailable'); values.set(key, value); } };
  const draft = new DraftController('owner-a', storage);
  draft.load(); draft.choosePreset(preset); draft.edit(words); draft.seal();
  return { draft, storage, values, fail: (value: boolean) => { fail = value; } };
}
function transport(submit: BurnTransport['submit'], lookup: BurnTransport['lookup'] = async () => ({ receipt: null })): BurnTransport { return { submit, lookup }; }

test('burn preparation must be persisted before a request can leave the device', async () => {
  const f = fixture(); let calls = 0;
  const burn = new BurnController(f.draft, transport(async () => { calls++; return receipt(); }), () => requestId);
  f.fail(true); await burn.confirm();
  assert.equal(calls, 0); assert.equal(f.draft.getSnapshot().draft!.stage, 'sealed');
  assert.equal(f.draft.getSnapshot().draft!.text, words);
});

test('a successful burn clears text before completion and cannot be reopened', async () => {
  const f = fixture();
  const burn = new BurnController(f.draft, transport(async request => {
    assert.deepEqual(request, { requestId, type: 'TEXT', destinationType: 'BURNING', textContent: words, presetId: preset.id, burnConfirmed: true });
    assert.equal(decodeDraft(f.storage.read(f.draft.key), 'owner-a').stage, 'burn-pending');
    return receipt();
  }), () => requestId);
  await burn.confirm();
  assert.equal(f.draft.getSnapshot().draft!.stage, 'burned');
  assert.equal(f.draft.getSnapshot().draft!.text, '');
  assert.ok(!f.storage.read(f.draft.key)!.includes(words));
  f.draft.unseal(); f.draft.edit('Cannot restore it'); f.draft.choosePreset(preset);
  assert.equal(f.draft.getSnapshot().draft!.stage, 'burned');
  assert.equal(f.draft.getSnapshot().draft!.text, '');
});

test('duplicate taps share one request and an uncertain retry reuses the saved ID and body', async () => {
  const f = fixture(); const requests: BurnLetterRequest[] = [];
  let rejectFirst: (error: Error) => void = () => {};
  const burn = new BurnController(f.draft, transport(request => {
    requests.push(request);
    if (requests.length === 1) return new Promise((_resolve, reject) => { rejectFirst = reject; });
    return Promise.resolve(receipt());
  }), () => requestId);
  const first = burn.confirm(); const duplicate = burn.confirm();
  assert.equal(first, duplicate); assert.equal(requests.length, 1);
  f.draft.unseal(); f.draft.edit('Must remain locked');
  assert.equal(f.draft.reset(), false);
  rejectFirst(new Error('Network reply lost')); await first;
  assert.equal(f.draft.getSnapshot().draft!.stage, 'burn-pending');
  await burn.retry();
  assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]);
  assert.equal(f.draft.getSnapshot().draft!.stage, 'burned');
});

test('after a lost success reply, reopening checks a receipt without sending the letter again', async () => {
  const f = fixture(); let submissions = 0;
  const api = transport(async () => { submissions++; throw new Error('Reply lost after commit'); }, async id => ({ receipt: receipt(id) }));
  await new BurnController(f.draft, api, () => requestId).confirm();
  const restored = new DraftController('owner-a', f.storage); restored.load();
  assert.equal(restored.getSnapshot().draft!.stage, 'burn-pending');
  await new BurnController(restored, api, () => nextId).check();
  assert.equal(submissions, 1); assert.equal(restored.getSnapshot().draft!.stage, 'burned');
  assert.ok(!f.storage.read(f.draft.key)!.includes(words));
});

test('a missing receipt is uncertain and never unlocks the pending letter', async () => {
  const f = fixture();
  f.draft.beginBurn(requestId);
  await new BurnController(f.draft, transport(async () => receipt()), () => nextId).check();
  f.draft.unseal(); assert.equal(f.draft.reset(), false);
  assert.equal(f.draft.getSnapshot().draft!.stage, 'burn-pending');
});

test('only a matching durable rejection restores an editable letter, with a new ID next time', async () => {
  const f = fixture(); const requests: string[] = []; let count = 0;
  const burn = new BurnController(f.draft, transport(async request => { requests.push(request.requestId); return receipt(request.requestId, requests.length === 1 ? 'REJECTED' : 'BURNED'); }), () => count++ ? nextId : requestId);
  await burn.confirm();
  assert.equal(f.draft.getSnapshot().draft!.stage, 'sealed'); assert.equal(f.draft.getSnapshot().draft!.text, words);
  f.draft.unseal(); f.draft.choosePreset({ ...preset, id: 'another_preset' }); f.draft.seal();
  await burn.confirm();
  assert.deepEqual(requests, [requestId, nextId]); assert.equal(f.draft.getSnapshot().draft!.text, '');
});

test('mismatched or malformed receipts never clear a letter', async () => {
  for (const invalid of [receipt(nextId), { ...receipt(), completedAt: 'invalid' }, { ...receipt(), reason: 'PRESET_UNAVAILABLE' }, { ...receipt(), receiptId: 'untrusted' }]) {
    const f = fixture();
    await new BurnController(f.draft, transport(async () => invalid as BurnReceipt), () => requestId).confirm();
    assert.equal(f.draft.getSnapshot().draft!.stage, 'burn-pending');
    assert.equal(f.draft.getSnapshot().draft!.text, words);
  }
});

test('a local cleanup failure hides content and leaves a restart-safe fence until cleanup succeeds', async () => {
  const f = fixture();
  const api = transport(async () => { f.fail(true); return receipt(); }, async () => ({ receipt: receipt() }));
  const burn = new BurnController(f.draft, api, () => requestId);
  await burn.confirm();
  assert.equal(f.draft.getSnapshot().draft!.stage, 'burned'); assert.equal(f.draft.getSnapshot().draft!.text, '');
  assert.equal(f.draft.getSnapshot().save, 'error'); assert.equal(f.draft.reset(), false);
  const restored = new DraftController('owner-a', f.storage); restored.load();
  assert.equal(restored.getSnapshot().draft!.stage, 'burn-pending');
  restored.unseal(); assert.equal(restored.getSnapshot().draft!.stage, 'burn-pending');
  f.fail(false); burn.retryCleanup();
  assert.equal(f.draft.getSnapshot().save, 'saved'); assert.ok(!f.storage.read(f.draft.key)!.includes(words));
});

test('a stale editor cannot overwrite the pending fence or resurrect a burned page', async () => {
  const f = fixture();
  const oldGeneration = f.draft.getSnapshot().draft!.generationId;
  const stale = new DraftController('owner-a', f.storage); stale.load();
  f.draft.beginBurn(requestId);
  stale.unseal(); assert.equal(stale.getSnapshot().draft!.stage, 'burn-pending');
  f.draft.applyBurnReceipt(receipt());
  stale.refresh(); stale.unseal(); stale.edit('Resurrected text');
  assert.equal(stale.getSnapshot().draft!.stage, 'burned'); assert.equal(stale.getSnapshot().draft!.text, '');
  f.draft.reset();
  stale.retrySave();
  assert.notEqual(stale.getSnapshot().draft!.generationId, oldGeneration);
  assert.equal(stale.getSnapshot().draft!.generationId, f.draft.getSnapshot().draft!.generationId);
});

test('an older release response cannot erase a newer page or another account', () => {
  const f = fixture(); f.draft.beginBurn(requestId);
  const newer = { ...newDraft('owner-a', 'new-page'), text: 'A new story.' };
  f.storage.write(f.draft.key, JSON.stringify(newer));
  const other = new DraftController('owner-b', f.storage); other.load(); other.edit('Another account.');
  f.draft.applyBurnReceipt(receipt());
  assert.equal(decodeDraft(f.storage.read(f.draft.key), 'owner-a').text, 'A new story.');
  assert.equal(decodeDraft(f.storage.read(other.key), 'owner-b').text, 'Another account.');
});

test('legacy Phase 3 drafts migrate without losing their words or stationery', () => {
  const raw = { version: 1, ownerId: 'owner-a', text: words, preset, stage: 'sealed', updatedAt: '2026-09-12T00:00:00Z', sealedAt: '2026-09-12T00:00:00Z' };
  const first = decodeDraft(JSON.stringify(raw), 'owner-a');
  const second = decodeDraft(JSON.stringify(raw), 'owner-a');
  assert.equal(first.version, 3); assert.equal(first.text, words); assert.equal(first.generationId, second.generationId); assert.equal(first.burnRequestId, null);
});
