import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coordinateSessionToken, SessionTokenError, tokenForSession } from '../src/auth/session-token';

test('HTTP and socket callers share one session function even when the SDK wrapper changes', async () => {
  let calls = 0;
  const client = { session: { id: 'first', getToken: async () => { calls++; return 'first-token'; } } };
  const token = tokenForSession(client, 'first');
  for (let i = 0; i < 100; i++) {
    client.session.getToken = async () => { calls++; return 'first-token'; };
    assert.equal(tokenForSession(client, 'first'), token);
  }
  assert.deepEqual(await Promise.all(Array.from({ length: 100 }, () => token())), Array(100).fill('first-token'));
  assert.equal(calls, 1);
});

test('simultaneous expired-token retries perform one forced refresh and normal reads join it', async () => {
  const options: boolean[] = []; let finish!: (value: string) => void;
  const token = coordinateSessionToken(async option => { options.push(Boolean(option?.skipCache)); return option?.skipCache ? new Promise<string>(resolve => { finish = resolve; }) : 'cached'; });
  assert.equal(await token(), 'cached');
  const requests = Array.from({ length: 30 }, () => token({ skipCache: true }));
  requests.push(token()); await Promise.resolve(); finish('fresh');
  assert.deepEqual(await Promise.all(requests), Array(31).fill('fresh')); assert.deepEqual(options, [false, true]);
});

test('a provider 429 pauses all callers until its retry window expires', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000 }); let calls = 0;
  const token = coordinateSessionToken(async () => { calls++; if (calls === 1) throw { status: 429, retryAfter: 60 }; return 'recovered'; });
  await assert.rejects(token(), SessionTokenError);
  for (let i = 0; i < 50; i++) await assert.rejects(token({ skipCache: i % 2 === 0 }), SessionTokenError);
  assert.equal(calls, 1); t.mock.timers.tick(60_000); assert.equal(await token(), 'recovered'); assert.equal(calls, 2);
});

test('changing accounts while a refresh is queued never requests the new account token', async () => {
  let finish!: (value: string) => void; let newCalls = 0;
  const client = { session: { id: 'first', getToken: () => new Promise<string>(resolve => { finish = resolve; }) } };
  const first = tokenForSession(client, 'first'); const reading = first(); const refreshing = first({ skipCache: true });
  client.session = { id: 'second', getToken: async () => { newCalls++; return 'second-token'; } };
  finish('old-token'); assert.equal(await reading, null); assert.equal(await refreshing, null); assert.equal(newCalls, 0);
  assert.equal(await tokenForSession(client, 'second')(), 'second-token'); assert.equal(await first(), null);
});

test('a stalled SDK refresh is bounded and cannot trigger a rapid retry storm', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: 1_000 }); let calls = 0;
  const token = coordinateSessionToken(() => { calls++; return new Promise(() => {}); });
  const rejected = assert.rejects(token(), (error: unknown) => error instanceof SessionTokenError && error.reason === 'timeout');
  t.mock.timers.tick(10_000); await rejected;
  await assert.rejects(token(), SessionTokenError); assert.equal(calls, 1);
});
