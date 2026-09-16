import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { randomUUID } from 'node:crypto';
import type { PalaceEventPage } from '@lantern-post/shared-types';
import { createFriendsTestApp } from './friends-fixture';
import { PalaceEvents } from '../src/realtime/palace-events';

let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
before(async () => { context = await createFriendsTestApp(true, undefined, undefined, 'disabled'); });
beforeEach(() => { context.fixture.reset(); context.fixture.state.requests.push({ id: 'friendship', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date() }); });
after(async () => context.app.close());
const request = (path: string, owner = 'bob', body?: unknown) => fetch(context.url + path, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: 'Bearer ' + owner, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const inbox = async () => await (await request('/notifications/inbox')).json() as PalaceEventPage;
async function arrivals() {
  assert.equal((await request('/letters', 'alice', { requestId: randomUUID(), type: 'TEXT', destinationType: 'FRIEND', recipientId: 'owner-bob', presetId: 'preset_lantern', textContent: 'Private letter remains intact', deliveryConfirmed: true })).status, 200);
  assert.equal((await request('/chat/owner-bob/messages', 'alice', { requestId: randomUUID(), text: 'Private message remains intact', confirmed: true })).status, 200);
  return (await inbox()).events;
}

test('opening or dismissing notices survives a fresh client and leaves both content copies untouched', async () => {
  const events = await arrivals(); assert.equal(events.length, 2);
  const letters = structuredClone(context.fixture.state.letters), messages = structuredClone(context.fixture.state.chatMessages);
  const result = await request('/notifications/state', 'bob', { seenIds: [events[0]!.id], dismissedIds: [events[1]!.id] });
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), { saved: true });
  const freshClient = await inbox(); assert.equal(freshClient.events.length, 1); assert.equal(freshClient.events[0]!.seen, true); assert.equal(freshClient.events[0]!.alert, false);
  assert.deepEqual(context.fixture.state.letters, letters); assert.deepEqual(context.fixture.state.chatMessages, messages);
  assert.equal((await request('/notifications/state', 'bob', { seenIds: [], dismissedIds: [events[0]!.id] })).status, 200);
  assert.equal((await inbox()).events.length, 0);
  const live = await context.app.get(PalaceEvents).read('owner-bob', 0); assert.ok(live.events.every(event => !event.alert));
  assert.ok(live.events.some(event => event.kind === 'LETTERBOX_CHANGED' && event.sequence > events.at(-1)!.sequence));
});

test('foreign and missing IDs cannot mutate another account or disclose its notifications', async () => {
  const events = await arrivals(); const original = structuredClone(context.fixture.state.events);
  const response = await request('/notifications/state', 'carol', { seenIds: events.map(event => event.id), dismissedIds: ['does-not-exist', events[0]!.id] });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { saved: true });
  assert.deepEqual(context.fixture.state.events, original);
  assert.equal((await inbox()).events.length, 2);
  assert.equal((await request('/notifications/state', 'invalid', { seenIds: [], dismissedIds: [] })).status, 401);
  context.fixture.state.users.find(user => user.id === 'owner-bob')!.accountState = 'DELETING';
  assert.equal((await request('/notifications/state', 'bob', { seenIds: [], dismissedIds: [events[0]!.id] })).status, 410);
});

test('repeated or stale state writes cannot resurrect notices or allocate duplicate refresh events', async () => {
  const events = await arrivals(); const batch = { seenIds: events.map(event => event.id), dismissedIds: [events[1]!.id] };
  await request('/notifications/state', 'bob', batch); const count = context.fixture.state.events.length;
  const times = context.fixture.state.events.filter(event => event.ownerId === 'owner-bob').map(event => [event.id, event.seenAt, event.dismissedAt]);
  await request('/notifications/state', 'bob', batch);
  await request('/notifications/state', 'bob', { seenIds: [events[1]!.id], dismissedIds: [] });
  assert.equal(context.fixture.state.events.length, count);
  assert.deepEqual(context.fixture.state.events.filter(event => event.ownerId === 'owner-bob').map(event => [event.id, event.seenAt, event.dismissedAt]), times);
  assert.equal((await inbox()).events.length, 1);
});

test('state updates are bounded, cannot import another owner field, and ignore expired events', async () => {
  const events = await arrivals();
  for (const body of [{ seenIds: new Array(501).fill('x'), dismissedIds: [] }, { seenIds: ['x', 'x'], dismissedIds: [] }, { seenIds: [], dismissedIds: [], ownerId: 'owner-alice' }, { seenIds: [true], dismissedIds: [] }]) {
    assert.equal((await request('/notifications/state', 'bob', body)).status, 400);
  }
  for (const event of context.fixture.state.events) event.createdAt = new Date(Date.now() - 8 * 86400000);
  assert.equal((await request('/notifications/state', 'bob', { seenIds: [], dismissedIds: events.map(event => event.id) })).status, 200);
  assert.ok(context.fixture.state.events.every(event => !event.seenAt && !event.dismissedAt));
  assert.equal((await inbox()).events.length, 0);
});

test('a queued phone alert is suppressed after its notice was read or dismissed', async () => {
  const events = await arrivals(); await request('/notifications/state', 'bob', { seenIds: [events[0]!.id], dismissedIds: [events[1]!.id] });
  await request('/notifications/register', 'bob', { token: 'ExpoPushToken[fixture-read-notices]', platform: 'android' });
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = (async (url, options) => {
    if (String(url) !== 'https://exp.host/--/api/v2/push/send') return original(url, options);
    calls++; return Response.json({ data: [{ status: 'ok', id: 'fixture' }] });
  }) as typeof fetch;
  try { await context.notifications.dispatch(); assert.equal(calls, 0); } finally { globalThis.fetch = original; }
});
