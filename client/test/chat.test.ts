import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setImmediate } from 'node:timers/promises';
import type { ChatMessage, ChatPage, ChatReceipt } from '@lantern-post/shared-types';
import { ChatDraftController } from '../src/chat/chat-draft';
import { ChatSession } from '../src/chat/chat-session';
import { ChatFault, mergeMessages, readChatPage, readChatReceipt } from '../src/chat/chat-contract';
import type { ChatTransport } from '../src/chat/chat-contract';
import { usernameCard } from '../src/friends/username-card-contract';
function fixture(owner = 'a', peer = 'b') {
  const values = new Map<string, string>(); let fail = false;
  const storage = { read: (key: string) => values.get(key) ?? null, write: (key: string, value: string) => { if (fail) throw Error('Unavailable'); values.set(key, value); } };
  const draft = new ChatDraftController(owner, peer, storage); draft.load();
  return { draft, values, storage, fail: (value: boolean) => { fail = value; } };
}
const page = (messages: ChatMessage[] = []): ChatPage => ({ peer: { id: 'b', username: 'bob', character: null }, messages, cursor: messages.at(-1)?.sequence ?? 0, before: null });
const receipt = (requestId: string): ChatReceipt => ({ requestId, peerId: 'b', outcome: 'DELIVERED', reason: null, messageId: 'chatmsg_' + randomUUID(), sequence: 1, completedAt: new Date().toISOString() });
const message = (sequence: number): ChatMessage => ({ id: 'chatmsg_' + randomUUID(), sequence, side: 'theirs', text: 'Synthetic words.', createdAt: new Date().toISOString() });

test('unsent markers retain sequence identity and cannot be overwritten by a late plaintext page', () => {
  const original = message(1), removed = { ...original, text: 'This message was unsent.', removed: true as const };
  assert.equal(readChatPage(page([removed]), 'b').messages[0]!.removed, true);
  assert.throws(() => readChatPage(page([{ ...original, removed: true }]), 'b'));
  assert.deepEqual(mergeMessages([removed], [original]), [removed]);
});

test('message synchronization preserves the ordered cursor and late reads cannot undo an unsend', async () => {
  const f = fixture(), original = { ...message(1), side: 'mine' as const };
  let finish!: (messages: ChatMessage[]) => void;
  const api = transport({ history: async () => page([original]), sync: async () => new Promise(resolve => { finish = resolve; }), remove: async () => {} });
  const session = new ChatSession('b', api, f.draft, randomUUID); session.start();
  while (session.getSnapshot().phase !== 'ready') await setImmediate();
  const sync = session.synchronize(); while (!finish) await setImmediate();
  await session.remove(original.id, 'everyone'); finish([original]); await sync;
  assert.equal(session.getSnapshot().messages[0]!.removed, true); assert.equal(session.getSnapshot().cursor, 1);
  await session.remove(original.id, 'self'); assert.equal(session.getSnapshot().messages.length, 0);
  session.stop();
});

test('recovering an old send receipt reads current visibility rather than restoring unsent draft text', async () => {
  const f = fixture(); f.draft.edit('Previously sent private words'); const requestId = randomUUID(); f.draft.confirm(requestId);
  const delivered = receipt(requestId), removed = { id: delivered.messageId!, sequence: 1, side: 'mine' as const, text: 'This message was unsent.', removed: true as const, createdAt: delivered.completedAt };
  const session = new ChatSession('b', transport({ receipt: async () => delivered, sync: async () => [removed] }), f.draft, randomUUID);
  session.start(); while (f.draft.pending()) await setImmediate();
  assert.equal(session.getSnapshot().messages[0]!.removed, true); assert.ok(!JSON.stringify(session.getSnapshot()).includes('Previously sent private words'));
  session.stop();
});
function transport(overrides: Partial<ChatTransport> = {}): ChatTransport {
  return { capabilities: async () => ({ textAvailable: true }), history: async () => page(), poll: async (_peer, _after, signal) => new Promise((_resolve, reject) => { if (signal?.aborted) reject(Error('Stopped')); else signal?.addEventListener('abort', () => reject(Error('Stopped')), { once: true }); }), send: async (_peer, input) => receipt(input.requestId), receipt: async () => null, cancel: async (_peer, requestId) => ({ ...receipt(requestId), outcome: 'REJECTED', reason: 'CANCELLED', messageId: null, sequence: null }), report: async () => ({ id: 'report', status: 'OPEN', createdAt: new Date().toISOString(), blocked: false }), ...overrides };
}
test('username sharing contains only the public username and a fixed calling-card invitation', () => {
  const card = usernameCard('moon_rose'); assert.deepEqual(Object.keys(card), ['title', 'text']); assert.ok(card.text.includes('@moon_rose')); assert.ok(!card.text.includes('localhost')); for (const value of ['bad name', 'a', '@alice', 'alice@example.com', 'https://private.invalid']) assert.throws(() => usernameCard(value));
});
test('chat drafts are scoped by account and peer, including delimiter-like IDs', () => {
  const f = fixture(); f.draft.edit('Only this conversation.'); const restored = new ChatDraftController('a', 'b', f.storage); restored.load(); assert.equal(restored.getSnapshot().draft!.text, 'Only this conversation.');
  for (const pair of [['b', 'a'], ['a', 'c'], ['a--b', 'c'], ['a', 'b--c']]) { const other = new ChatDraftController(pair[0]!, pair[1]!, f.storage); other.load(); assert.equal(other.getSnapshot().draft!.text, ''); other.edit(pair.join('/')); }
  assert.notEqual(new ChatDraftController('a--b', 'c', f.storage).key, new ChatDraftController('a', 'b--c', f.storage).key);
});
test('pending confirmation requires a saved message and failed writes keep its words', () => {
  const f = fixture(); f.draft.edit('Keep these words.'); f.fail(true); assert.equal(f.draft.confirm(randomUUID()), false); assert.equal(f.draft.pending(), null); assert.equal(f.draft.getSnapshot().draft!.text, 'Keep these words.'); f.fail(false); assert.ok(f.draft.retrySave()); assert.ok(f.draft.confirm(randomUUID())); f.draft.edit('Cannot change a pending message.'); assert.equal(f.draft.pending()!.text, 'Keep these words.');
});
test('rejections restore words, successful receipts clear them and late receipts cannot erase another message', () => {
  const f = fixture(); f.draft.edit('Hello.'); const id = randomUUID(); f.draft.confirm(id); f.draft.apply({ ...receipt(id), outcome: 'REJECTED', reason: 'CANCELLED', messageId: null, sequence: null }); assert.equal(f.draft.getSnapshot().draft!.text, 'Hello.'); f.draft.edit('A new message.'); const next = randomUUID(); f.draft.confirm(next); assert.equal(f.draft.apply(receipt(id)), false); assert.equal(f.draft.pending()!.requestId, next); f.draft.apply(receipt(next)); assert.equal(f.draft.getSnapshot().draft!.text, '');
});
test('ordinary unsent messages never enter reconnect recovery', async () => {
  const f = fixture(); f.draft.edit('Do not send automatically.'); let sends = 0; let lookups = 0;
  const session = new ChatSession('b', transport({ send: async (_p, body) => { sends++; return receipt(body.requestId); }, receipt: async () => { lookups++; return null; } }), f.draft, randomUUID); session.start(); await setImmediate(); assert.equal(session.getSnapshot().phase, 'ready'); assert.equal(sends, 0); assert.equal(lookups, 0); session.stop();
});
test('confirmed recovery looks up receipts first and retries the original UUID only when capability is available', async () => {
  const f = fixture(); const id = randomUUID(); f.draft.edit('A confirmed message.'); f.draft.confirm(id); const calls: string[] = []; let available = false;
  const session = new ChatSession('b', transport({ capabilities: async () => ({ textAvailable: available }), receipt: async () => { calls.push('lookup'); return null; }, send: async (_peer, body) => { calls.push(body.requestId); return receipt(body.requestId); } }), f.draft, randomUUID);
  session.start(); await setImmediate(); assert.deepEqual(calls, ['lookup']); available = true; await session.recover(); assert.deepEqual(calls, ['lookup', 'lookup', id]); assert.equal(f.draft.pending(), null); session.stop();
});
test('a known receipt recovers without another send and a stopped listener ignores late messages', async () => {
  const f = fixture(); const id = randomUUID(); f.draft.edit('Already delivered.'); f.draft.confirm(id); let sends = 0; let deliver!: (value: ChatPage) => void;
  const session = new ChatSession('b', transport({ receipt: async () => receipt(id), send: async (_p, body) => { sends++; return receipt(body.requestId); }, poll: () => new Promise(resolve => { deliver = resolve; }) }), f.draft, randomUUID);
  session.start(); await setImmediate(); assert.equal(sends, 0); assert.equal(f.draft.pending(), null); const confirmed=session.getSnapshot().messages;assert.equal(confirmed[0]?.text,'Already delivered.');session.stop(); deliver(page([message(1)])); await setImmediate(); assert.deepEqual(session.getSnapshot().messages, confirmed);
});
test('a gate closure clears the transcript without discarding local unsent words', async () => {
  const f = fixture(); f.draft.edit('Keep my own unsent words.'); const session = new ChatSession('b', transport({ history: async () => page([message(1)]), poll: async () => { throw new ChatFault('closed'); } }), f.draft, randomUUID);
  session.start(); await setImmediate(); assert.equal(session.getSnapshot().phase, 'closed'); assert.deepEqual(session.getSnapshot().messages, []); assert.equal(f.draft.getSnapshot().draft!.text, 'Keep my own unsent words.'); session.stop();
});
test('duplicate taps and navigation while sending retain a single durable pending UUID', async () => {
  const f = fixture(); f.draft.edit('Once only.'); let resolve!: (value: ChatReceipt) => void; const ids: string[] = [];
  const session = new ChatSession('b', transport({ send: async (_p, body) => { ids.push(body.requestId); return new Promise(done => { resolve = done; }); } }), f.draft, randomUUID);
  session.start(); await setImmediate(); const first = session.send(); await session.send(); assert.equal(ids.length, 1); session.stop(); resolve(receipt(ids[0]!)); await first; assert.equal(f.draft.pending()!.requestId, ids[0]);
});
test('wire contracts reject a wrong peer or request and transcript merging stays bounded', () => {
  const good = page([message(1)]); assert.equal(readChatPage(good, 'b').messages.length, 1); assert.throws(() => readChatPage(good, 'c')); const id = randomUUID(); assert.throws(() => readChatReceipt(receipt(id), randomUUID(), 'b'));
  const messages = Array.from({ length: 210 }, (_, i) => message(i + 1)); const merged = mergeMessages(messages.slice(0, 150), messages.slice(140)); assert.equal(merged.length, 200); assert.equal(merged[0]!.sequence, 11); assert.equal(new Set(merged.map(m => m.id)).size, 200);
});

test('a confirmed own message appears before the socket reply without advancing past unseen incoming messages',async()=>{
  const f=fixture();f.draft.edit('A fast confirmed message.');let deliver!:(value:ChatPage)=>void;let own!:ChatReceipt;
  const api=transport({history:async()=>page([message(1),message(2)]),poll:()=>new Promise(resolve=>{deliver=resolve;}),send:async(_peer,input)=>{own={...receipt(input.requestId),sequence:5};return own;}});
  const session=new ChatSession('b',api,f.draft,randomUUID);session.start();await setImmediate();await session.send();assert.equal(session.getSnapshot().cursor,2);assert.equal(session.getSnapshot().messages.at(-1)?.sequence,5);
  deliver(page([message(3),message(4),{id:own.messageId!,sequence:5,side:'mine',text:'A fast confirmed message.',createdAt:own.completedAt}]));await setImmediate();assert.deepEqual(session.getSnapshot().messages.map(m=>m.sequence),[1,2,3,4,5]);session.stop();
});

test('the first transcript and live stream do not wait for a separate availability response', async () => {
  const f = fixture(); f.draft.edit('Not yet confirmed.'); let allow!: (caps: { textAvailable: boolean }) => void; let streaming = false;
  const session = new ChatSession('b', transport({ history: async () => page([message(1)]), capabilities: () => new Promise(resolve => { allow = resolve; }), poll: async (_p, _after, signal) => { streaming = true; return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(Error('Stopped')), { once: true })); } }), f.draft, randomUUID);
  session.start(); await setImmediate();
  assert.equal(session.getSnapshot().phase, 'ready'); assert.equal(session.getSnapshot().messages.length, 1); assert.equal(streaming, true);
  await session.send(); assert.equal(f.draft.pending(), null);
  allow({ textAvailable: true }); await setImmediate(); assert.equal(session.getSnapshot().available, true); session.stop();
});

test('a pending receipt lookup cannot delay incoming messages or spawn duplicate recovery lookups', async () => {
  const f = fixture(); f.draft.edit('An already confirmed message.'); f.draft.confirm(randomUUID());
  let resolveReceipt!: (value: ChatReceipt | null) => void; let deliver!: (value: ChatPage) => void; let lookups = 0;
  const session = new ChatSession('b', transport({ open: async () => ({ ...page([message(1)]), capabilities: { textAvailable: true } }), capabilities: async () => ({ textAvailable: false }), receipt: () => { lookups++; return new Promise(resolve => { resolveReceipt = resolve; }); }, poll: () => new Promise(resolve => { deliver = resolve; }) }), f.draft, randomUUID);
  session.start(); await setImmediate(); deliver(page([message(2)])); await setImmediate(); await session.recover();
  assert.deepEqual(session.getSnapshot().messages.map(row => row.sequence), [1, 2]); assert.equal(lookups, 1);
  resolveReceipt(null); await setImmediate(); assert.ok(f.draft.pending()); session.stop();
});

test('a terminal send rejection stops a concurrent stream from restoring the closed transcript', async () => {
  const f = fixture(); f.draft.edit('Keep this unsent text.'); let deliver!: (value: ChatPage) => void;
  const session = new ChatSession('b', transport({ open: async () => ({ ...page([message(1)]), capabilities: { textAvailable: true } }), poll: () => new Promise(resolve => { deliver = resolve; }), send: async (_peer, input) => ({ ...receipt(input.requestId), outcome: 'REJECTED', reason: 'FRIEND_UNAVAILABLE', messageId: null, sequence: null }) }), f.draft, randomUUID);
  session.start(); await setImmediate(); await session.send(); deliver(page([message(2)])); await setImmediate();
  assert.equal(session.getSnapshot().phase, 'closed'); assert.deepEqual(session.getSnapshot().messages, []); assert.equal(f.draft.getSnapshot().draft?.text, 'Keep this unsent text.');
});

test('reconnection resumes after the last ordered page instead of reloading or skipping history', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); const f = fixture(); const cursors: (number | undefined)[] = []; let calls = 0;
  const session = new ChatSession('b', transport({ open: async (_peer, _signal, after) => { cursors.push(after); return { ...page([message(after === undefined ? 10 : 11)]), before: after === undefined ? 10 : null, capabilities: { textAvailable: true } }; }, poll: async (_peer, _after, signal) => { if (++calls === 1) throw new ChatFault('connection'); return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(Error('Stopped')), { once: true })); } }), f.draft, randomUUID);
  session.start(); await setImmediate(); t.mock.timers.tick(1000); await setImmediate();
  assert.deepEqual(cursors, [undefined, 10]); assert.deepEqual(session.getSnapshot().messages.map(row => row.sequence), [10, 11]); session.stop();
});
