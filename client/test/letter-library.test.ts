import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { decodeDraft, DraftController, draftKey, newDraft } from '../src/letters/draft';
import { LetterLibrary, letterDocumentId } from '../src/letters/letter-library';
import type { LetterLibraryStorage } from '../src/letters/letter-library';
import type { LetterPreset } from '@lantern-post/shared-types';

const preset: LetterPreset = { id: 'preset_lantern', key: 'parchment', displayName: 'Parchment', description: 'Old paper.', config: { paperColor: '#F8EED6', inkColor: '#443C2F', sealColor: '#946347', ribbonColor: '#849079', texture: 'parchment', motif: 'royal', font: 'book' } };
function fixture() {
  const values = new Map<string, string>(); let failed = false;
  const storage: LetterLibraryStorage = { keys: () => [...values.keys()], read: key => values.get(key) ?? null, write: (key, value) => { if (failed) throw new Error('Storage full'); values.set(key, value); } };
  const library = new LetterLibrary('owner-a', storage, randomUUID);
  const edit = (id: string, owner = 'owner-a') => { const editor = new DraftController(owner, storage, randomUUID, letterDocumentId(id)); editor.load(); return editor; };
  return { values, storage, library, edit, fail: (value: boolean) => { failed = value; } };
}
test('legacy pending letters stay in place while a separate page is written and a late receipt arrives', () => {
  const f = fixture(); const original = f.library.open(); const old = f.edit(original); old.choosePreset(preset); old.edit('Release this old thought.'); old.seal();
  const requestId = randomUUID(); assert.ok(old.beginBurn(requestId)); const pending = f.storage.read(old.key);
  assert.ok(!JSON.stringify(f.library.entries()).includes('Release this old thought.'), 'Pending receipt fences also hide snippets in the cabinet.');
  const next = f.library.create(); const editor = f.edit(next); editor.choosePreset(preset); editor.edit('A different thought to keep.');
  assert.equal(f.storage.read(old.key), pending);
  assert.ok(old.applyBurnReceipt({ requestId, receiptId: `burn_${'a'.repeat(64)}`, outcome: 'BURNED', reason: null, completedAt: new Date().toISOString() }));
  assert.equal(editor.getSnapshot().draft!.text, 'A different thought to keep.');
  assert.equal(f.edit(next).getSnapshot().draft!.text, 'A different thought to keep.');
  assert.equal(f.edit(original).getSnapshot().draft!.text, '');
  assert.equal(f.library.entries().length, 2); assert.equal(f.library.open(), next);
});
test('independent cabinet instances cannot lose each other’s new pages and account prefixes do not overlap', () => {
  const f = fixture(); const other = new LetterLibrary('owner-a', f.storage, randomUUID);
  const one = f.library.create(); const two = other.create(); f.edit(one).edit('First'); f.edit(two).edit('Second');
  const foreign = new LetterLibrary('owner-a-extended', f.storage, randomUUID); foreign.create();
  assert.deepEqual(new Set(f.library.entries().map(e => e.id)), new Set([one, two])); assert.equal(foreign.entries().length, 1);
  assert.equal(new LetterLibrary('owner-b', f.storage, randomUUID).entries().length, 0);
  assert.throws(() => f.edit('../owner-b'));
});
test('separate text, stationery, voice metadata and caption survive switching without leaking captions into lists', () => {
  const f = fixture(); const text = f.library.create(); const first = f.edit(text); first.choosePreset(preset); first.edit('Keep my stationery.'); first.seal();
  const voice = f.library.create(); const second = f.edit(voice); second.choosePreset(preset); second.changeKind('VOICE'); second.attachVoice({ id: randomUUID(), byteLength: 1024, durationMs: 1500, mimeType: 'audio/webm' }); second.editVoiceCaption('PRIVATE_CAPTION');
  assert.equal(f.edit(text).getSnapshot().draft!.stage, 'sealed'); assert.equal(f.edit(text).getSnapshot().draft!.text, 'Keep my stationery.');
  assert.equal(f.edit(voice).getSnapshot().draft!.voiceCaption, 'PRIVATE_CAPTION'); assert.ok(!JSON.stringify(f.library.entries()).includes('PRIVATE_CAPTION'));
});
test('old voice cleanup queues are preserved without a migration copy, and failures do not replace any letter', () => {
  const f = fixture(); const clip = randomUUID(); const saved = { ...newDraft('owner-a'), kind: 'VOICE', voiceDeletes: [clip] };
  f.storage.write(draftKey('owner-a'), JSON.stringify(saved)); assert.equal(f.library.open(), 'original');
  assert.deepEqual(f.edit('original').getSnapshot().draft!.voiceDeletes, [clip]); const before = [...f.values];
  f.fail(true); assert.throws(() => f.library.create()); assert.deepEqual([...f.values], before);
  f.fail(false); f.library.create(); assert.deepEqual(decodeDraft(f.storage.read(draftKey('owner-a')), 'owner-a').voiceDeletes, [clip]);
});
test('corrupt records are visible for restoration and never overwritten when starting another letter', () => {
  const f = fixture(); f.storage.write(draftKey('owner-a'), 'not-json'); assert.equal(f.library.open(), 'original');
  assert.equal(f.library.entries()[0]!.stage, 'unreadable'); f.library.create(); assert.equal(f.storage.read(draftKey('owner-a')), 'not-json');
});
test('a finished visit opens a fresh page and retains only the cleared completed record', () => {
  const f = fixture(); const old = f.edit(f.library.open()); old.choosePreset(preset); old.edit('Let this go.'); old.seal(); const requestId = randomUUID(); old.beginBurn(requestId);
  old.applyBurnReceipt({ requestId, receiptId: `burn_${'b'.repeat(64)}`, outcome: 'BURNED', reason: null, completedAt: new Date().toISOString() });
  const fresh = f.library.open(); assert.notEqual(fresh, 'original'); assert.equal(f.edit(fresh).getSnapshot().draft!.stage, 'writing'); assert.equal(f.edit('original').getSnapshot().draft!.stage, 'burned');
});
