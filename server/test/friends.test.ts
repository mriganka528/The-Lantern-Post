import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import type { FriendConnection, FriendSearchResponse, FriendSummary, FriendsPage } from '@lantern-post/shared-types';
import { createFriendsTestApp } from './friends-fixture';
let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
before(async () => { context = await createFriendsTestApp(true); });
beforeEach(() => context.fixture.reset());
after(async () => { await context.app.close(); });
const request = (path: string, token = 'alice', body?: unknown) => fetch(`${context.url}${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const send = (username = 'bob', token = 'alice') => request('/friends/requests', token, { username });
const reply = (id: string, action = 'accept', token = 'bob') => request(`/friends/requests/${id}/respond`, token, { action });
const list = (token = 'alice', view = 'friends', cursor = '') => request(`/friends?view=${view}${cursor ? `&cursor=${cursor}` : ''}`, token);
const expoToken = 'ExponentPushToken[synthetic-device-token-001]';

test('friend and device-token endpoints require authentication before any database read', async () => {
  for (const [path, body] of [['/friends', undefined], ['/friends/search?username=bob', undefined], ['/friends/summary', undefined], ['/friends/requests', { username: 'bob' }], ['/friends/requests/foreign/respond', { action: 'accept' }], ['/notifications/register', { token: expoToken, platform: 'ios' }], ['/notifications/unregister', { token: expoToken }], ['/notifications/settings', undefined]] as const) {
    assert.equal((await request(path, '', body)).status, 401); assert.equal((await request(path, 'forged', body)).status, 401);
  }
  assert.equal(context.fixture.state.calls, 0);
});
test('friend inputs reject identity spoofing, invalid names, actions, cursors and unsupported device tokens', async () => {
  for (const body of [{}, { username: 'ab' }, { username: 'a'.repeat(25) }, { username: 'a/b' }, { username: ['bob'] }, { username: 'bob', fromUserId: 'owner-carol' }, { username: 'bob', status: 'ACCEPTED' }]) assert.equal((await request('/friends/requests', 'alice', body)).status, 400);
  assert.equal((await request('/friends?view=everyone')).status, 400);
  assert.equal((await request('/friends?cursor=not-a-cursor')).status, 400);
  assert.equal((await request('/friends/search?username=bob&authProviderId=carol')).status, 400);
  assert.equal((await request('/friends/requests/x/respond', 'bob', { action: 'accept', toUserId: 'owner-bob' })).status, 400);
  assert.equal((await reply('x', 'cancel')).status, 400);
  for (const body of [{ token: 'https://invalid.test', platform: 'ios' }, { token: expoToken, platform: 'web' }, { token: expoToken, platform: 'ios', userId: 'owner-bob' }]) assert.equal((await request('/notifications/register', 'alice', body)).status, 400);
  assert.equal(context.fixture.state.requests.length, 0);
});
test('username search normalizes case and returns only safe cards, excluding self, unfinished and blocked accounts', async () => {
  const response = await request('/friends/search?username=%20BOB%20'); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json() as FriendSearchResponse; assert.equal(result.results.length, 1); assert.equal(result.results[0]!.person.username, 'bob');
  const text = JSON.stringify(result); for (const forbidden of ['authProviderId', 'privateField', 'must-not-leak', 'secret', 'blockedUsers']) assert.ok(!text.includes(forbidden));
  assert.equal((await (await request('/friends/search?username=alice')).json() as FriendSearchResponse).results.length, 0);
  assert.equal((await (await request('/friends/search?username=bert')).json() as FriendSearchResponse).results.length, 0);
  context.fixture.state.blocks.push({ blockerId: 'owner-bob', blockedId: 'owner-alice' });
  assert.equal((await (await request('/friends/search?username=bob')).json() as FriendSearchResponse).results.length, 0);
  assert.equal((await send()).status, 404);
});
test('search is bounded and list cursors paginate only the verified owner’s relationships', async () => {
  for (let i = 0; i < 27; i++) {
    const person = context.fixture.user(`guest_${String(i).padStart(2, '0')}`); context.fixture.state.users.push(person);
    context.fixture.state.requests.push({ id: `req${i}`, fromUserId: i % 2 ? person.id : 'owner-alice', toUserId: i % 2 ? 'owner-alice' : person.id, status: 'ACCEPTED', createdAt: new Date(1700000000000 + i), respondedAt: new Date() });
  }
  const matches = await (await request('/friends/search?username=guest')).json() as FriendSearchResponse;
  assert.equal(matches.results.length, 20); assert.equal(matches.hasMore, true);
  context.fixture.state.users.push(context.fixture.user('guestx00'));
  assert.deepEqual((await (await request('/friends/search?username=guest_00')).json() as FriendSearchResponse).results.map(r => r.person.username), ['guest_00']);
  const first = await (await list()).json() as FriendsPage; assert.equal(first.items.length, 24); assert.ok(first.nextCursor);
  const second = await (await list('alice', 'friends', first.nextCursor!)).json() as FriendsPage; assert.equal(second.items.length, 3); assert.equal(second.nextCursor, null);
  assert.equal(new Set([...first.items, ...second.items].map(i => i.id)).size, 27);
  assert.deepEqual(await (await list('bob', 'friends', first.nextCursor!)).json(), { items: [], nextCursor: null });
});
test('an invitation is persistent and owner scoped; duplicate retries enqueue just one notification', async () => {
  const responses = await Promise.all(Array.from({ length: 6 }, () => send())); assert.ok(responses.every(r => r.status === 200));
  const rows = await Promise.all(responses.map(r => r.json() as Promise<FriendConnection>)); rows.forEach(r => assert.deepEqual(r, rows[0]));
  assert.equal(rows[0]!.status, 'PENDING'); assert.equal(rows[0]!.direction, 'outgoing'); assert.equal(context.fixture.state.requests.length, 1); assert.equal(context.fixture.state.jobs.length, 1);
  assert.equal((await (await list('bob', 'incoming')).json() as FriendsPage).items[0]!.person.username, 'alice');
  assert.deepEqual(await (await request('/friends/summary')).json(), { friends: 0, incoming: 0, outgoing: 1 });
  assert.equal((await (await list('carol', 'incoming')).json() as FriendsPage).items.length, 0);
});
test('crossed requests converge on one pending invitation without silently accepting it', async () => {
  const rows = await Promise.all([send(), send('alice', 'bob')]); const data = await Promise.all(rows.map(r => r.json() as Promise<FriendConnection>));
  assert.equal(data[0]!.id, data[1]!.id); assert.equal(data[0]!.status, 'PENDING'); assert.equal(data[1]!.status, 'PENDING');
  assert.notEqual(data[0]!.direction, data[1]!.direction); assert.equal(context.fixture.state.requests.length, 1); assert.equal(context.fixture.state.jobs.length, 1);
});
test('only the addressed recipient can accept; both palaces then show the same mutual friendship', async () => {
  const invitation = await (await send()).json() as FriendConnection;
  assert.equal((await reply(invitation.id, 'accept', 'alice')).status, 404); assert.equal((await reply(invitation.id, 'accept', 'carol')).status, 404);
  const accepted = await reply(invitation.id); assert.equal(accepted.status, 200); assert.equal((await accepted.json() as FriendConnection).status, 'ACCEPTED');
  assert.equal((await reply(invitation.id)).status, 200); assert.equal(context.fixture.state.jobs.length, 2);
  for (const who of ['alice', 'bob']) { const friends = await (await list(who)).json() as FriendsPage; assert.equal(friends.items.length, 1); assert.notEqual(friends.items[0]!.person.username, who); assert.equal((await (await request('/friends/summary', who)).json() as FriendSummary).friends, 1); }
  assert.equal((await reply(invitation.id, 'decline')).status, 409);
});
test('declines do not create friendships; cooldown and fresh IDs prevent stale tabs answering a later invitation', async () => {
  const invitation = await (await send()).json() as FriendConnection;
  assert.equal((await reply(invitation.id, 'decline')).status, 200); assert.equal((await reply(invitation.id, 'decline')).status, 200); assert.equal(context.fixture.state.jobs.length, 1);
  assert.equal((await send()).status, 409); assert.equal((await reply(invitation.id)).status, 409);
  assert.equal((await (await list()).json() as FriendsPage).items.length, 0);
  context.fixture.state.requests[0]!.respondedAt = new Date(Date.now() - 86_400_001);
  const newRequest = await (await send()).json() as FriendConnection; assert.notEqual(newRequest.id, invitation.id); assert.equal(newRequest.status, 'PENDING');
  assert.equal((await reply(invitation.id)).status, 404); assert.equal(context.fixture.state.jobs.length, 1);
});
test('a block added after sending hides the request and prevents its acceptance in either direction', async () => {
  const invitation = await (await send()).json() as FriendConnection;
  context.fixture.state.blocks.push({ blockerId: 'owner-alice', blockedId: 'owner-bob' });
  assert.equal((await reply(invitation.id)).status, 404); assert.equal((await (await list('bob', 'incoming')).json() as FriendsPage).items.length, 0);
  assert.equal((await send('alice', 'bob')).status, 404);
});
test('a profile and companion are required and self-invitations are unavailable', async () => {
  assert.equal((await send('bob', 'new-user')).status, 409); assert.equal((await send('bob', 'bert')).status, 409); assert.equal((await send('alice')).status, 404);
});
test('outbox failure rolls back the invitation; serialization conflicts retry with no duplicate state', async () => {
  context.fixture.state.failJob = true; const failure = await send(); assert.equal(failure.status, 503); assert.ok(!(await failure.text()).includes('private'));
  assert.equal(context.fixture.state.requests.length, 0); context.fixture.state.failJob = false;
  context.fixture.state.conflicts = 2; assert.equal((await send()).status, 200); assert.equal(context.fixture.state.requests.length, 1);
  context.fixture.state.conflicts = 4; assert.equal((await send('carol')).status, 503); assert.equal(context.fixture.state.requests.length, 1);
});
test('the daily invitation limit does not charge retries or prevent responding', async () => {
  for (let i = 0; i < 20; i++) { const u = context.fixture.user(`guest_${i}`); context.fixture.state.users.push(u); context.fixture.state.requests.push({ id: `r${i}`, fromUserId: 'owner-alice', toUserId: u.id, status: 'PENDING', createdAt: new Date(), respondedAt: null }); }
  assert.equal((await send()).status, 429); assert.equal((await send('guest_0')).status, 200);
  const incoming = await (await send('alice', 'bob')).json() as FriendConnection; assert.equal((await reply(incoming.id, 'accept', 'alice')).status, 200);
});
test('device registration transfers an installation to the current owner and old logout cannot unregister it', async () => {
  const body = { token: expoToken, platform: 'ios' };
  const first = await request('/notifications/register', 'alice', body); assert.equal(first.status, 200); assert.deepEqual(await first.json(), { enabled: true });
  assert.equal((await request('/notifications/register', 'bob', body)).status, 200); assert.equal(context.fixture.state.tokens.length, 1);
  await request('/notifications/unregister', 'alice', { token: expoToken }); assert.equal(context.fixture.state.tokens.length, 1); assert.equal(context.fixture.state.tokens[0]!.userId, 'owner-bob');
  await request('/notifications/unregister', 'bob', { token: expoToken }); assert.equal(context.fixture.state.tokens.length, 0);
});
test('outbox delivery uses generic text and the correct recipient; stale invitations are suppressed', async () => {
  const invitation = await (await send()).json() as FriendConnection;
  await request('/notifications/register', 'bob', { token: expoToken, platform: 'android' });
  const previous = globalThis.fetch; const sent: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input, init) => {
    if (String(input) !== 'https://exp.host/--/api/v2/push/send') return previous(input, init);
    sent.push(...JSON.parse(String(init?.body)) as Record<string, unknown>[]); return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'synthetic-ticket' }] }), { status: 200 });
  }) as typeof fetch;
  try { await context.notifications.dispatch(); assert.equal(sent.length, 1); assert.equal(sent[0]!.to, expoToken); assert.equal((sent[0]!.data as Record<string, unknown>).ownerId, 'owner-bob'); assert.ok(!JSON.stringify(sent).includes('alice')); assert.ok(context.fixture.state.jobs[0]!.completedAt);
    await reply(invitation.id, 'decline'); context.fixture.state.jobs[0]!.completedAt = null; await context.notifications.dispatch(); assert.equal(sent.length, 1);
  } finally { globalThis.fetch = previous; }
});
test('push failures back off without undoing friendship and invalid device tokens are retired', async () => {
  await send(); await request('/notifications/register', 'bob', { token: expoToken, platform: 'ios' });
  const previous = globalThis.fetch; let invalid = false;
  globalThis.fetch = (async (input, init) => String(input) !== 'https://exp.host/--/api/v2/push/send' ? previous(input, init) : invalid ? new Response(JSON.stringify({ data: [{ status: 'error', details: { error: 'DeviceNotRegistered' } }] }), { status: 200 }) : new Response('', { status: 503 })) as typeof fetch;
  try { await context.notifications.dispatch(); assert.equal(context.fixture.state.requests.length, 1); assert.equal(context.fixture.state.jobs[0]!.attempts, 1); assert.equal(context.fixture.state.jobs[0]!.completedAt, null); assert.ok((context.fixture.state.jobs[0]!.availableAt as Date).getTime() > Date.now());
    invalid = true; context.fixture.state.jobs[0]!.availableAt = new Date(0); await context.notifications.dispatch(); assert.equal(context.fixture.state.tokens.length, 0); assert.ok(context.fixture.state.jobs[0]!.completedAt);
  } finally { globalThis.fetch = previous; }
});

test('acceptance notifies the original sender while the older pending-invitation notice is suppressed', async () => {
  const invitation = await (await send()).json() as FriendConnection; await reply(invitation.id);
  await request('/notifications/register', 'alice', { token: expoToken, platform: 'ios' });
  await request('/notifications/register', 'bob', { token: 'ExpoPushToken[synthetic-other-device]', platform: 'android' });
  const previous = globalThis.fetch; const sent: Record<string, unknown>[] = [];
  globalThis.fetch = (async (input, init) => {
    if (String(input) !== 'https://exp.host/--/api/v2/push/send') return previous(input, init);
    sent.push(...JSON.parse(String(init?.body)) as Record<string, unknown>[]); return new Response(JSON.stringify({ data: [{ status: 'ok', id: 'accepted-ticket' }] }), { status: 200 });
  }) as typeof fetch;
  try { await context.notifications.dispatch(); assert.equal(sent.length, 1); assert.equal(sent[0]!.to, expoToken); assert.equal((sent[0]!.data as Record<string, unknown>).type, 'FRIEND_ACCEPTED'); assert.equal((sent[0]!.data as Record<string, unknown>).ownerId, 'owner-alice'); }
  finally { globalThis.fetch = previous; }
});
test('disabled push leaves registration unavailable and never starts an external dispatcher', async () => {
  const disabled = await createFriendsTestApp(false);
  try {
    assert.deepEqual(await (await fetch(`${disabled.url}/notifications/settings`, { headers: { Authorization: 'Bearer alice' } })).json(), { enabled: false });
    const response = await fetch(`${disabled.url}/notifications/register`, { method: 'POST', headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' }, body: JSON.stringify({ token: expoToken, platform: 'ios' }) });
    assert.equal(response.status, 409); assert.equal(disabled.fixture.state.tokens.length, 0); await disabled.notifications.dispatch();
  } finally { await disabled.app.close(); }
});
