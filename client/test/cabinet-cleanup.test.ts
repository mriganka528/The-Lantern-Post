import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import { test } from 'node:test';
import { CabinetCleanup } from '../src/letters/cabinet-cleanup';
import { draftKey, newDraft, decodeDraft } from '../src/letters/draft';
import type { LetterLibraryStorage } from '../src/letters/letter-library';
function fixture() {
  const values = new Map<string, string>(); const watchers = new Set<(key: string | null) => void>();
  const storage: LetterLibraryStorage = { keys: () => [...values.keys()], read: key => values.get(key) ?? null, write: (key, value) => { values.set(key, value); queueMicrotask(() => watchers.forEach(listener => listener(key))); }, watch: listener => { watchers.add(listener); return () => { watchers.delete(listener); }; } };
  return { storage, values };
}
test('late local cleanup clears only the inactive owned letter and preserves other drafts and accounts', async () => {
  const { storage } = fixture(); const activeKey = draftKey('a'); const inactiveKey = draftKey('a', randomUUID()); const foreignKey = draftKey('b', randomUUID());
  const activeClip = randomUUID(); const oldClip = randomUUID(); const foreignClip = randomUUID();
  storage.write(activeKey, JSON.stringify({ ...newDraft('a'), voiceDeletes: [activeClip] })); storage.write(foreignKey, JSON.stringify({ ...newDraft('b'), voiceDeletes: [foreignClip] }));
  const removed: string[] = []; const stop = new CabinetCleanup('a', activeKey, storage, async (owner, id) => { removed.push(`${owner}:${id}`); }).start();
  storage.write(inactiveKey, JSON.stringify({ ...newDraft('a'), voiceDeletes: [oldClip] })); await setImmediate(); await setImmediate();
  assert.deepEqual(removed, [`a:${oldClip}`]); assert.deepEqual(decodeDraft(storage.read(inactiveKey), 'a').voiceDeletes, []); assert.deepEqual(decodeDraft(storage.read(activeKey), 'a').voiceDeletes, [activeClip]); stop();
});
test('failed deletion stays durable and can be retried on the next cabinet visit', async () => {
  const { storage } = fixture(); const key = draftKey('a', randomUUID()); const id = randomUUID(); storage.write(key, JSON.stringify({ ...newDraft('a'), voiceDeletes: [id] }));
  const stop = new CabinetCleanup('a', draftKey('a'), storage, async () => { throw new Error('Unavailable'); }).start(); await setImmediate(); stop(); assert.deepEqual(decodeDraft(storage.read(key), 'a').voiceDeletes, [id]);
  const retry = new CabinetCleanup('a', draftKey('a'), storage, async () => {}).start(); await setImmediate(); assert.deepEqual(decodeDraft(storage.read(key), 'a').voiceDeletes, []); retry();
});
test('leaving or changing account stops additional deletions and leaves an unacknowledged queue recoverable', async () => {
  const { storage } = fixture(); const key = draftKey('a', randomUUID()); const ids = [randomUUID(), randomUUID()]; storage.write(key, JSON.stringify({ ...newDraft('a'), voiceDeletes: ids }));
  let finish!: () => void; let calls = 0; const held = new Promise<void>(resolve => { finish = resolve; });
  const stop = new CabinetCleanup('a', draftKey('a'), storage, async () => { calls++; await held; }).start(); await setImmediate(); stop(); finish(); await setImmediate();
  assert.equal(calls, 1); assert.deepEqual(decodeDraft(storage.read(key), 'a').voiceDeletes, ids);
});
