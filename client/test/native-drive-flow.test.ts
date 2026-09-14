import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID, randomBytes } from 'node:crypto';
import { connectNativeDrive, DRIVE_APPDATA_SCOPE } from '../src/backups/native-drive-flow';
import type { NativeDriveLink, NativeDrivePicker, NativeDriveTransport } from '../src/backups/native-drive-flow';

function fixture() {
  const link: NativeDriveLink = { id: randomUUID(), state: randomBytes(32).toString('base64url'), webClientId: '123-fixture.apps.googleusercontent.com', scopes: [DRIVE_APPDATA_SCOPE], expiresAt: new Date(Date.now()+60000).toISOString() };
  const calls: string[] = [];
  const transport: NativeDriveTransport = {
    begin: async () => { calls.push('begin'); return link; },
    complete: async (value, code) => { assert.equal(value, link); assert.equal(code, 'SYNTHETIC_CODE'); calls.push('complete'); return { connected: true }; },
    cancel: async () => { calls.push('cancel'); },
  };
  const picker: NativeDrivePicker = { authorize: async () => { calls.push('picker'); return 'SYNTHETIC_CODE'; }, foreground: async () => true };
  return { link, calls, transport, picker, abort: new AbortController() };
}

test('native Drive completes one explicit foreground attempt using the original server state', async () => {
  const f = fixture(); assert.equal(await connectNativeDrive(f.transport, f.picker, f.abort.signal), true);
  assert.deepEqual(f.calls, ['begin', 'picker', 'complete']);
});

test('unexpected scopes or malformed connection metadata never open the native account picker', async () => {
  for (const change of [{ scopes: ['https://www.googleapis.com/auth/drive'] }, { webClientId: 'invalid' }, { state: 'invalid' }]) {
    const f = fixture(); Object.assign(f.link, change);
    await assert.rejects(connectNativeDrive(f.transport, f.picker, f.abort.signal));
    assert.deepEqual(f.calls, ['begin']);
  }
});

test('cancelling the native picker closes its pending state without exchanging any code', async () => {
  const f = fixture(); f.picker.authorize = async () => null;
  assert.equal(await connectNativeDrive(f.transport, f.picker, f.abort.signal), false);
  assert.deepEqual(f.calls, ['begin', 'cancel']);
});

test('late native results after route/account cancellation cannot make an API completion request', async () => {
  const f = fixture(); f.picker.authorize = async () => { f.abort.abort(); return 'SYNTHETIC_CODE'; };
  await assert.rejects(connectNativeDrive(f.transport, f.picker, f.abort.signal), /cancelled/);
  assert.deepEqual(f.calls, ['begin']);
});

test('background completion and ambiguous HTTP failures never retry a Google grant', async () => {
  const background = fixture(); background.picker.foreground = async () => false;
  await assert.rejects(connectNativeDrive(background.transport, background.picker, background.abort.signal), /interrupted/);
  assert.deepEqual(background.calls, ['begin', 'picker']);
  const failed = fixture(); failed.transport.complete = async () => { failed.calls.push('complete'); throw Error('Network unavailable'); };
  await assert.rejects(connectNativeDrive(failed.transport, failed.picker, failed.abort.signal));
  assert.deepEqual(failed.calls, ['begin', 'picker', 'complete']);
});
