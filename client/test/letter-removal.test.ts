import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import type { LetterPreset } from '@lantern-post/shared-types';
import { DraftController, draftKey, newDraft } from '../src/letters/draft';
import { LetterLibrary, letterDocumentId, LetterRemovalError } from '../src/letters/letter-library';
import type { LetterLibraryStorage } from '../src/letters/letter-library';
import { readRemovedLetter } from '../src/letters/removed-letter';
import { CabinetCleanup } from '../src/letters/cabinet-cleanup';
const preset: LetterPreset = { id: 'preset', key: 'ivory', displayName: 'Ivory', description: 'Paper.', config: { paperColor: '#F8EED6', inkColor: '#443C2F', sealColor: '#946347', ribbonColor: '#849079', texture: 'parchment', motif: 'royal', font: 'book' } };
function fixture() {
  const values = new Map<string, string>(); const watchers = new Set<(key: string | null) => void>(); let fail = false;
  const storage: LetterLibraryStorage = { keys: () => [...values.keys()], read: key => values.get(key) ?? null, write: (key, value) => { if (fail) throw new Error('Storage unavailable'); values.set(key, value); queueMicrotask(() => watchers.forEach(listener => listener(key))); }, watch: listener => { watchers.add(listener); return () => { watchers.delete(listener); }; } };
  const library = new LetterLibrary('owner-a', storage, randomUUID);
  const editor = (id: string) => { const controller = new DraftController('owner-a', storage, randomUUID, letterDocumentId(id)); controller.load(); controller.choosePreset(preset); return controller; };
  return { values, storage, library, editor, fail: (value: boolean) => { fail = value; } };
}
test('removing an unfinished original page erases its content and permanently fences stale editors', () => {
  const f = fixture(); const id = f.library.open(); const old = f.editor(id); old.edit('PRIVATE WORDS TO REMOVE');
  const other = f.library.create(); f.editor(other).edit('Keep this other page.'); const keep = f.storage.read(draftKey('owner-a', other));
  f.library.remove(f.library.prepareRemoval(id));
  assert.ok(!f.storage.read(old.key)!.includes('PRIVATE WORDS')); assert.equal(f.storage.read(draftKey('owner-a', other)), keep);
  old.edit('A stale tab cannot restore these words.'); assert.equal(old.getSnapshot().phase, 'removed'); assert.equal(old.getSnapshot().draft, null); assert.equal(old.reset(), false); assert.equal(old.retrySave(), false);
  assert.deepEqual(f.library.entries().map(e => e.id), [other]);
  f.library.remember(id); assert.equal(f.library.open(), other);
});
test('removing the last blank or sealed letter preserves the marker and the next visit uses a different document', () => {
  const f = fixture(); const id = f.library.open(); const editor = f.editor(id); editor.edit('Seal then remove.'); editor.seal();
  f.library.remove(f.library.prepareRemoval(id)); assert.equal(f.library.entries().length, 0);
  const next = f.library.open(); assert.notEqual(next, id); assert.equal(f.editor(next).getSnapshot().draft!.text, ''); assert.ok(readRemovedLetter(f.storage.read(editor.key), 'owner-a'));
  f.library.remove(f.library.prepareRemoval(next)); assert.equal(f.library.entries().length, 0);
});
test('a changed revision or a newly pending operation cannot be removed with an older confirmation', () => {
  const f = fixture(); const id = f.library.open(); const editor = f.editor(id); editor.edit('Original.'); const ticket = f.library.prepareRemoval(id);
  editor.edit('Changed in another window.'); assert.throws(() => f.library.remove(ticket), (e: unknown) => e instanceof LetterRemovalError && e.code === 'changed'); assert.equal(editor.getSnapshot().draft!.text, 'Changed in another window.');
  const fresh = f.library.prepareRemoval(id); editor.seal(); editor.beginBurn(randomUUID()); const pending = f.storage.read(editor.key);
  assert.throws(() => f.library.remove(fresh), (e: unknown) => e instanceof LetterRemovalError && e.code === 'protected'); assert.equal(f.storage.read(editor.key), pending);
});
test('pending private/public letters and completed receipts cannot be discarded from the cabinet', () => {
  const f = fixture();
  for (const destination of ['friend', 'world', 'burn'] as const) {
    const id = f.library.create(); const editor = f.editor(id); editor.edit('A confirmed operation.'); editor.seal(); const requestId = randomUUID();
    if (destination === 'friend') editor.beginDelivery(requestId, { id: 'owner-b', username: 'bob', characterKey: 'fox-lantern', palaceName: 'The Amber Palace' });
    else if (destination === 'world') editor.beginWorld(requestId); else editor.beginBurn(requestId);
    assert.throws(() => f.library.prepareRemoval(id));
    if (destination === 'burn') { editor.applyBurnReceipt({ requestId, receiptId: 'burn_' + 'a'.repeat(64), outcome: 'BURNED', reason: null, completedAt: new Date().toISOString() }); assert.throws(() => f.library.prepareRemoval(id)); assert.equal(editor.getSnapshot().draft!.stage, 'burned'); }
  }
});
test('failed removal writes and foreign-account records are never treated as deleted', () => {
  const f = fixture(); const id = f.library.open(); const editor = f.editor(id); editor.edit('Keep when storage fails.'); const ticket = f.library.prepareRemoval(id); const before = f.storage.read(editor.key);
  f.fail(true); assert.throws(() => f.library.remove(ticket)); assert.equal(f.storage.read(editor.key), before); f.fail(false);
  const foreign = new LetterLibrary('owner-b', f.storage, randomUUID); assert.throws(() => foreign.remove(ticket)); assert.equal(f.storage.read(editor.key), before);
});
test('voice removal clears caption/clip together and retries its durable deletion queue after failure', async () => {
  const f = fixture(); const id = f.library.open(); const editor = f.editor(id); editor.changeKind('VOICE'); const clip = { id: randomUUID(), mimeType: 'audio/webm' as const, byteLength: 1024, durationMs: 2000 }; editor.attachVoice(clip); editor.editVoiceCaption('PRIVATE CAPTION'); editor.seal();
  f.library.remove(f.library.prepareRemoval(id)); const marker = f.storage.read(editor.key)!;
  assert.ok(!marker.includes('PRIVATE CAPTION')); assert.ok(!marker.includes('"voice":')); assert.deepEqual(readRemovedLetter(marker, 'owner-a')!.voiceDeletes, [clip.id]); assert.equal(f.library.pendingRemovals(), 1);
  let fail = true; const removed: string[] = []; const stop = new CabinetCleanup('owner-a', editor.key, f.storage, async (owner, target) => { assert.equal(owner, 'owner-a'); if (fail) throw Error('Temporary failure'); removed.push(target); }).start();
  await setImmediate(); assert.equal(f.library.pendingRemovals(), 1); fail = false; f.library.retryRemovalCleanup(); await setImmediate(); await setImmediate();
  assert.deepEqual(removed, [clip.id]); assert.equal(f.library.pendingRemovals(), 0); assert.equal(f.library.entries().length, 0); stop();
});
test('removal retains the entire legacy cleanup queue plus the current recording', () => {
  const f = fixture(); const id = f.library.open(); const voiceDeletes = Array.from({ length: 8 }, () => randomUUID()); const voice = { id: randomUUID(), mimeType: 'audio/mp4', byteLength: 1024, durationMs: 2000 };
  f.storage.write(draftKey('owner-a'), JSON.stringify({ ...newDraft('owner-a'), kind: 'VOICE', voice, voiceDeletes }));
  f.library.remove(f.library.prepareRemoval(id)); assert.deepEqual(readRemovedLetter(f.storage.read(draftKey('owner-a')), 'owner-a')!.voiceDeletes, [...voiceDeletes, voice.id]);
});
