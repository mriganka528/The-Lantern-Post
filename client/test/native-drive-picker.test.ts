import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { createNativeDrivePicker } from '../src/backups/native-drive-picker';
import type { DriveGoogleSdk } from '../src/backups/native-drive-picker';
import { connectNativeDrive, DRIVE_APPDATA_SCOPE } from '../src/backups/native-drive-flow';
import type { NativeDriveLink } from '../src/backups/native-drive-flow';

const link = (): NativeDriveLink => ({ id: randomUUID(), state: randomBytes(32).toString('base64url'), webClientId: '123-fixture.apps.googleusercontent.com', scopes: [DRIVE_APPDATA_SCOPE], expiresAt: new Date(Date.now()+60000).toISOString() });
function success(): Awaited<ReturnType<DriveGoogleSdk['signIn']>> {
  return { type: 'success', data: { user: { id: 'private-google-id', name: 'Private Name', email: 'private@example.invalid', photo: null, familyName: null, givenName: null }, scopes: [DRIVE_APPDATA_SCOPE], idToken: 'PRIVATE_ID_TOKEN', serverAuthCode: 'SYNTHETIC_CODE' } };
}

test('the native SDK requests only the additional app-data scope and forwards only the server code', async () => {
  const current = link(); const configured: unknown[] = []; const posted: unknown[] = [];
  const sdk: DriveGoogleSdk = { configure: input => { configured.push(input); }, hasPlayServices: async () => true, signIn: async () => success() };
  const picker = createNativeDrivePicker(async () => sdk, async () => true);
  assert.equal(await connectNativeDrive({ begin: async () => current, cancel: async () => {}, complete: async (received, code) => { posted.push({ id: received.id, state: received.state, code }); return { connected: true }; } }, picker, new AbortController().signal), true);
  assert.deepEqual(configured, [{ webClientId: current.webClientId, scopes: [DRIVE_APPDATA_SCOPE], offlineAccess: true, forceCodeForRefreshToken: true }]);
  assert.deepEqual(posted, [{ id: current.id, state: current.state, code: 'SYNTHETIC_CODE' }]);
  assert.ok(!JSON.stringify(posted).includes('private')); assert.ok(!JSON.stringify(posted).includes('PRIVATE_ID_TOKEN'));
});

test('native cancellation, missing Play services and missing grants never invent a code', async () => {
  const sdk: DriveGoogleSdk = { configure: () => {}, hasPlayServices: async () => true, signIn: async () => ({ type: 'cancelled', data: null }) };
  const picker = createNativeDrivePicker(async () => sdk, async () => true);
  assert.equal(await picker.authorize(link(), new AbortController().signal), null);
  sdk.hasPlayServices = async () => false;
  await assert.rejects(picker.authorize(link(), new AbortController().signal), /Play services/);
  sdk.hasPlayServices = async () => true;
  sdk.signIn = async () => { const result = success(); if (result.type === 'success') result.data.serverAuthCode = null; return result; };
  await assert.rejects(picker.authorize(link(), new AbortController().signal), /could not connect/);
});

test('a result after cancellation or without foreground cannot leave the native adapter', async () => {
  const abort = new AbortController();
  const sdk: DriveGoogleSdk = { configure: () => {}, hasPlayServices: async () => true, signIn: async () => { abort.abort(); return success(); } };
  await assert.rejects(createNativeDrivePicker(async () => sdk, async () => true).authorize(link(), abort.signal), /interrupted/);
  sdk.signIn = async () => success();
  await assert.rejects(createNativeDrivePicker(async () => sdk, async () => false).authorize(link(), new AbortController().signal), /interrupted/);
  sdk.signIn = async () => { throw Error('PRIVATE_PROVIDER_TOKEN'); };
  await assert.rejects(createNativeDrivePicker(async () => sdk, async () => true).authorize(link(), new AbortController().signal), error => error instanceof Error && !error.message.includes('PRIVATE_PROVIDER_TOKEN'));
});
