import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BellSeenStore, bellKey } from '../src/notifications/bell-state';
import { assertPrivateWrite, closedAccountKey, privateKeyOwner } from '../src/account/local-privacy';

test('bell seen state survives reload and concurrent window updates without mixing accounts', () => {
  const saved = new Map<string, string>();
  const storage = { read: (key: string) => saved.get(key) ?? null, write: (key: string, value: string) => { saved.set(key, value); } };
  const alice = new BellSeenStore('alice', storage); const otherWindow = new BellSeenStore('alice', storage);
  alice.markSeen(['letter-event']); otherWindow.markSeen(['chat-event']);
  assert.deepEqual(new BellSeenStore('alice', storage).getSnapshot().seen, ['letter-event', 'chat-event']);
  assert.deepEqual(new BellSeenStore('bob', storage).getSnapshot().seen, []);
  assert.equal(privateKeyOwner(bellKey('alice')), 'alice');
});
test('storage failures leave notifications unseen and can be retried', () => {
  let raw: string | null = null; let fail = true;
  const store = new BellSeenStore('alice', { read: () => raw, write: (_key, value) => { if (fail) throw Error('Full disk'); raw = value; } });
  store.markSeen(['arrival']); assert.deepEqual(store.getSnapshot(), { seen: [], error: true });
  fail = false; store.markSeen(['arrival']); assert.deepEqual(store.getSnapshot(), { seen: ['arrival'], error: false });
});
test('account closure fences bell writes and long notification history stays bounded', () => {
  const saved = new Map<string, string>();
  const read = (key: string) => saved.get(key) ?? null;
  const store = new BellSeenStore('alice', { read, write: (key, value) => { assertPrivateWrite(key, read); saved.set(key, value); } });
  store.markSeen(Array.from({ length: 650 }, (_, i) => 'event-' + i)); assert.equal(store.getSnapshot().seen.length, 500);
  saved.set(closedAccountKey('alice'), 'closed'); const before = saved.get(bellKey('alice'));
  store.markSeen(['new-event']); assert.equal(store.getSnapshot().error, true); assert.equal(saved.get(bellKey('alice')), before);
});
