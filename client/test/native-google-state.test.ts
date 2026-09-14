import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNativeGooglePickerOpen, withNativeGooglePicker, waitForNativeGoogleForeground } from '../src/auth/native-google-state';
import { activateNativeGoogleSession } from '../src/auth/google-flow';

test('a native Google sheet exempts only its own live operation and always releases the lock', async () => {
  const owner = new AbortController(); const other = new AbortController();
  let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
  const result = withNativeGooglePicker(owner.signal, async () => { await held; return 'done'; });
  assert.equal(isNativeGooglePickerOpen(owner.signal), true);
  assert.equal(isNativeGooglePickerOpen(other.signal), false);
  await assert.rejects(withNativeGooglePicker(other.signal, async () => true), /still finishing/);
  owner.abort(); assert.equal(isNativeGooglePickerOpen(owner.signal), false);
  release(); await assert.rejects(result, /interrupted/);
  assert.equal(isNativeGooglePickerOpen(owner.signal), false);
  assert.equal(await withNativeGooglePicker(other.signal, async () => 'next'), 'next');
});

test('a failed Google interaction releases the native lock', async () => {
  const abort = new AbortController();
  await assert.rejects(withNativeGooglePicker(abort.signal, async () => { throw Error('Synthetic failure'); }));
  assert.equal(isNativeGooglePickerOpen(abort.signal), false);
  assert.equal(await withNativeGooglePicker(abort.signal, async () => true), true);
});

test('native return waits for foreground and stops after cancellation or timeout', async () => {
  let listener: ((state: string) => void) | undefined; let removals = 0;
  const subscribe = (next: (state: string) => void) => { listener = next; return () => { removals++; }; };
  const abort = new AbortController();
  const resumed = waitForNativeGoogleForeground(() => 'background', subscribe, abort.signal, 1000);
  listener?.('active'); assert.equal(await resumed, true); assert.equal(removals, 1);
  const cancelled = waitForNativeGoogleForeground(() => 'background', subscribe, abort.signal, 1000);
  abort.abort(); assert.equal(await cancelled, false); assert.equal(removals, 2);
  const timeout = waitForNativeGoogleForeground(() => 'background', subscribe, new AbortController().signal, 10);
  assert.equal(await timeout, false); assert.equal(removals, 3);
});

test('native Google cancellation does not bind age, while success and extra verification remain explicit', async () => {
  const events: string[] = [];
  const remember = (id: string) => events.push(id); const clear = () => { throw Error('Unexpected clear'); };
  assert.equal(await activateNativeGoogleSession({ createdSessionId: null }, remember, clear), false);
  assert.equal(events.length, 0);
  await assert.rejects(activateNativeGoogleSession({ createdSessionId: null, signIn: { status: 'needs_second_factor' } }, remember, clear), /verification/);
  await assert.rejects(activateNativeGoogleSession({ createdSessionId: null, signUp: { status: 'missing_requirements' } }, remember, clear), /verification/);
  assert.equal(await activateNativeGoogleSession({ createdSessionId: null, signUp: { id: 'old-email-attempt', status: 'missing_requirements' } }, remember, clear, { signUpId: 'old-email-attempt' }), false);
  await assert.rejects(activateNativeGoogleSession({ createdSessionId: null, signUp: { id: 'new-google-attempt', status: 'missing_requirements' } }, remember, clear, { signUpId: 'old-email-attempt' }), /verification/);
  assert.equal(await activateNativeGoogleSession({ createdSessionId: 'sess_native', setActive: async ({ session }) => { events.push('active:' + session); } }, remember, clear), true);
  assert.deepEqual(events, ['sess_native', 'active:sess_native']);
});
