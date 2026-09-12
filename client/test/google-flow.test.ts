import assert from 'node:assert/strict';
import { test } from 'node:test';
import { activateGoogleSession, googleRedirects, requireGoogleAgeConfirmation } from '../src/auth/google-flow';
import { consumeGoogleAge, saveGoogleAge } from '../src/auth/google-age-storage';

test('Google entry requires the approved age confirmation before provider handoff', () => {
  assert.throws(() => requireGoogleAgeConfirmation(false), /at least 13/);
  assert.doesNotThrow(() => requireGoogleAgeConfirmation(true));
});

test('native Google success binds the age confirmation to the returned Clerk session', async () => {
  const events: string[] = [];
  const completed = await activateGoogleSession({
    createdSessionId: 'sess_google', authSessionResult: { type: 'success' },
    setActive: async ({ session }) => { events.push(`active:${session}`); },
  }, (session) => { events.push(`age:${session}`); }, () => { throw new Error('Must not clear a successful session'); });
  assert.equal(completed, true);
  assert.deepEqual(events, ['age:sess_google', 'active:sess_google']);
});

test('cancelled and incomplete Google flows never activate a session', async () => {
  let activated = false;
  const setActive = async () => { activated = true; };
  const remember = () => { throw new Error('Age must not bind without a completed session'); };
  assert.equal(await activateGoogleSession({ createdSessionId: null, authSessionResult: { type: 'cancel' }, setActive }, remember, () => {}), false);
  await assert.rejects(activateGoogleSession({ createdSessionId: null, authSessionResult: { type: 'success' }, setActive }, remember, () => {}), /another verification step/);
  assert.equal(activated, false);
});

test('a failed session activation clears only its own temporary age confirmation', async () => {
  const cleared: string[] = [];
  await assert.rejects(activateGoogleSession({
    createdSessionId: 'sess_google', setActive: async () => { throw new Error('Activation failed'); },
  }, () => {}, (session) => { cleared.push(session); }), /Activation failed/);
  assert.deepEqual(cleared, ['sess_google']);
});

test('browser redirects use fixed application routes and do not accept a return URL', () => {
  assert.deepEqual(googleRedirects('http://localhost:8081'), {
    strategy: 'oauth_google', redirectUrl: 'http://localhost:8081/oauth-callback', redirectUrlComplete: 'http://localhost:8081/oauth-complete',
  });
  assert.throws(() => googleRedirects('javascript:alert(1)'), /Invalid application origin/);
});

test('browser age confirmation is consumed once, expires, and stores no account data', () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  saveGoogleAge(storage, 1000);
  assert.deepEqual(JSON.parse([...values.values()][0] ?? '{}'), { confirmedAt: 1000 });
  assert.equal(consumeGoogleAge(storage, 2000), true);
  assert.equal(consumeGoogleAge(storage, 2000), false);
  saveGoogleAge(storage, 1000);
  assert.equal(consumeGoogleAge(storage, 1000 + 11 * 60 * 1000), false);
  saveGoogleAge(storage, 5000);
  assert.equal(consumeGoogleAge(storage, 1000), false);
});
