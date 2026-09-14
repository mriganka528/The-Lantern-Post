import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WelcomeNotification, welcomeNote } from '../src/notifications/welcome-notification';
import type { WelcomePort } from '../src/notifications/welcome-notification';

function fixture() {
  const state = { marker: null as string | null, granted: true, permissionPrompts: 0, scheduled: 0, exists: false, failSchedule: false, failComplete: false };
  const port: WelcomePort = {
    available: () => true, read: async () => state.marker,
    write: async marker => { if (marker === 'complete' && state.failComplete) throw Error('Storage unavailable'); state.marker = marker; },
    permission: async ask => { if (ask) state.permissionPrompts++; return state.granted; }, exists: async () => state.exists,
    schedule: async () => { if (state.failSchedule) throw Error('Phone unavailable'); state.scheduled++; state.exists = true; },
  };
  return { state, port, welcome: new WelcomeNotification(port) };
}
test('first launch schedules one local welcome across concurrent effects, accounts and relaunch', async () => {
  const { state, port, welcome } = fixture();
  await Promise.all([welcome.ensure(), welcome.ensure(), welcome.ensure()]);
  assert.equal(state.scheduled, 1); assert.equal(state.permissionPrompts, 1);
  await new WelcomeNotification(port).ensure(); await welcome.ensure(true); assert.equal(state.scheduled, 1);
  assert.deepEqual(welcomeNote.data, { type: 'PALACE_WELCOME' });
});
test('denied permission never schedules or automatically prompts again, but explicit settings can retry', async () => {
  const { state, welcome } = fixture(); state.granted = false;
  assert.equal(await welcome.ensure(), 'permission-needed'); await welcome.ensure(); assert.equal(state.permissionPrompts, 1); assert.equal(state.scheduled, 0);
  state.granted = true; assert.equal(await welcome.ensure(true), 'complete'); assert.equal(state.scheduled, 1);
});
test('failed scheduling stays retryable and a saved OS request prevents duplicates after a storage failure', async () => {
  const { state, welcome } = fixture(); state.failSchedule = true;
  await assert.rejects(welcome.ensure()); assert.equal(state.marker, 'asked');
  state.failSchedule = false; state.failComplete = true; await assert.rejects(welcome.ensure()); assert.equal(state.scheduled, 1);
  state.failComplete = false; await welcome.ensure(); assert.equal(state.scheduled, 1); assert.equal(state.marker, 'complete');
});
test('browser and unsupported runtimes never request notification permission or consume the welcome marker', async () => {
  const { state, port } = fixture(); port.available = () => false;
  assert.equal(await new WelcomeNotification(port).ensure(), 'unavailable'); assert.equal(state.marker, null); assert.equal(state.permissionPrompts, 0); assert.equal(state.scheduled, 0);
});
