import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BellSeenStore, bellKey } from '../src/notifications/bell-state';
import { BellSync } from '../src/notifications/bell-sync';
import type { NotificationStateUpdate } from '@lantern-post/shared-types';

function fixture() {
  const rows = new Map<string, string>();
  const storage = { read: (key: string) => rows.get(key) ?? null, write: (key: string, value: string) => { rows.set(key, value); } };
  return { rows, storage, store: new BellSeenStore('alice', storage) };
}
const empty = { seenIds: [], dismissedIds: [] };

test('v2 local choices migrate into a durable upload queue and failed sync survives a restart', async () => {
  const f = fixture();
  f.rows.set(bellKey('alice'), JSON.stringify({ version: 2, ownerId: 'alice', seen: ['old-seen', 'old-dismissed'], dismissed: ['old-dismissed'] }));
  const first = new BellSync(f.store, async () => { throw Error('offline'); }); first.start();
  try { await first.flush(); assert.equal(first.getSnapshot().error, true); } finally { first.stop(); }
  const restored = new BellSeenStore('alice', f.storage); const sent: NotificationStateUpdate[] = [];
  const second = new BellSync(restored, async batch => { sent.push(batch); }); second.start();
  try {
    await second.flush(); assert.deepEqual(sent, [{ seenIds: ['old-seen', 'old-dismissed'], dismissedIds: ['old-dismissed'] }]);
    assert.deepEqual(restored.pending(), empty); assert.deepEqual(restored.getSnapshot().dismissed, ['old-dismissed']);
    assert.deepEqual(new BellSeenStore('bob', f.storage).pending(), empty);
  } finally { second.stop(); }
});

test('a dismissal during an in-flight seen update stays queued and stale remote seen data cannot restore it', async () => {
  const f = fixture(); f.store.markSeen(['arrival']);
  let finish!: () => void; const sent: NotificationStateUpdate[] = [];
  const sync = new BellSync(f.store, async batch => { sent.push(batch); if (sent.length === 1) await new Promise<void>(resolve => { finish = resolve; }); }); sync.start();
  try {
    const first = sync.flush(); f.store.dismiss('arrival'); await sync.flush(); assert.equal(sent.length, 1);
    f.store.mergeRemoteSeen(['arrival']); finish(); await first;
    assert.deepEqual(f.store.pending(), { seenIds: [], dismissedIds: ['arrival'] });
    await sync.flush(); assert.equal(sent.length, 2); assert.deepEqual(f.store.pending(), empty);
    assert.deepEqual(f.store.getSnapshot().dismissed, ['arrival']);
  } finally { sync.stop(); }
});

test('background/account exit cancels the request and never acknowledges a late response', async () => {
  const f = fixture(); f.store.dismiss('arrival'); let finish!: () => void; let signal!: AbortSignal;
  const sync = new BellSync(f.store, async (_batch, abort) => { signal = abort; await new Promise<void>(resolve => { finish = resolve; }); }); sync.start();
  const pending = sync.flush(); sync.stop(); assert.equal(signal.aborted, true); finish(); await pending;
  assert.deepEqual(f.store.pending(), { seenIds: ['arrival'], dismissedIds: ['arrival'] });
  assert.deepEqual(new BellSeenStore('bob', f.storage).getSnapshot().dismissed, []);
});

test('remote read state hydrates a clean installation without reuploading it', () => {
  const f = fixture(); f.store.mergeRemoteSeen(['server-seen']);
  assert.deepEqual(f.store.getSnapshot().seen, ['server-seen']); assert.deepEqual(f.store.pending(), empty);
  f.store.markSeen(['server-seen']); assert.deepEqual(f.store.pending(), empty);
  f.store.dismiss('server-seen'); assert.deepEqual(f.store.pending(), { seenIds: [], dismissedIds: ['server-seen'] });
});

test('acknowledging one window cannot erase another window’s newer dismissal', () => {
  const f = fixture(); f.store.dismiss('first'); const batch = f.store.pending()!;
  const other = new BellSeenStore('alice', f.storage); other.dismiss('second');
  assert.equal(f.store.acknowledge(batch), true);
  assert.deepEqual(f.store.pending(), { seenIds: ['second'], dismissedIds: ['second'] });
  assert.deepEqual(f.store.getSnapshot().dismissed, ['first', 'second']);
});
