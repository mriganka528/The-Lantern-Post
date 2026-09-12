import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { friendNotificationEvent, parseSavedPush } from '../src/notifications/notification-contract';

let friends: typeof import('../src/friends/friends-api');
let api: typeof import('../src/api/client');
const originalApi = process.env.EXPO_PUBLIC_API_URL;
const originalKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const originalDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
before(async () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.invalid';
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk';
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  friends = await import('../src/friends/friends-api'); api = await import('../src/api/client');
});
after(() => {
  if (originalApi === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = originalApi;
  if (originalKey === undefined) delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = originalKey;
  if (originalDev) Object.defineProperty(globalThis, '__DEV__', originalDev); else Reflect.deleteProperty(globalThis, '__DEV__');
});

test('friend searches normalize a shared @name without accepting unsupported usernames', () => {
  assert.equal(friends.normalizeFriendSearch(' @Moon_Flower '), 'moon_flower'); assert.equal(friends.validFriendSearch(' @Moon_Flower '), true);
  for (const value of ['ab', 'a'.repeat(25), 'friend name', '../friend', 'friend@example', '@@friend', '友達たち']) assert.equal(friends.validFriendSearch(value), false);
});
test('friendship error messages retain useful recovery without reflecting provider details', () => {
  assert.match(friends.friendErrorMessage(new api.ApiError(429, 'INVITATION_LIMIT')), /tomorrow/);
  assert.match(friends.friendErrorMessage(new api.ApiError(409, 'INVITATION_RESOLVED')), /Refresh/);
  assert.ok(!friends.friendErrorMessage(new Error('private database error')).includes('private'));
});
test('saved push preferences are scoped to their owner and reject corrupt or non-Expo tokens', () => {
  const record = { ownerId: 'alice', token: 'ExpoPushToken[synthetic-token]' };
  assert.deepEqual(parseSavedPush(JSON.stringify({ ...record, privateExtra: 'omit' }), 'alice'), record);
  assert.equal(parseSavedPush(JSON.stringify(record), 'bob'), null);
  assert.equal(parseSavedPush('{invalid', 'alice'), null); assert.equal(parseSavedPush(JSON.stringify({ ...record, token: 'https://untrusted.test' }), 'alice'), null);
});
test('notification taps can only open the current owner’s friendship court', () => {
  const event = { ownerId: 'alice', screen: 'friends', type: 'FRIEND_REQUEST', eventId: 'request-1:received' };
  assert.equal(friendNotificationEvent(event, 'alice'), event.eventId);
  assert.equal(friendNotificationEvent(event, 'bob'), null);
  assert.equal(friendNotificationEvent({ ...event, screen: 'https://untrusted.test' }, 'alice'), null);
  assert.equal(friendNotificationEvent({ ...event, type: 'LETTER' }, 'alice'), null);
  assert.equal(friendNotificationEvent({ ...event, eventId: '' }, 'alice'), null);
});
