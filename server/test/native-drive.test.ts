import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import type { PrismaService } from '../src/database/prisma.service';
import type { Environment } from '../src/config/environment';
import { validateEnvironment } from '../src/config/environment';
import { DriveService } from '../src/backups/drive.service';
import { friendsFixture, createFriendsTestApp } from './friends-fixture';

const settings = {
  GOOGLE_DRIVE_CLIENT_ID: '123-fixture.apps.googleusercontent.com',
  GOOGLE_DRIVE_CLIENT_SECRET: 'SYNTHETIC_WEB_SECRET',
  GOOGLE_DRIVE_REDIRECT_URI: 'https://api.example.com/backups/drive/callback',
  GOOGLE_DRIVE_TOKEN_KEY: randomBytes(32).toString('base64'),
};
class NativeDriveFixture extends DriveService {
  calls: { url: string; form: URLSearchParams }[] = [];
  hold: Promise<void> | undefined; failRevoke = false;
  protected async request(url: string, options: RequestInit = {}) {
    this.calls.push({ url, form: new URLSearchParams(String(options.body || '')) });
    if (url === 'https://oauth2.googleapis.com/token') {
      await this.hold;
      return Response.json({ refresh_token: 'SYNTHETIC_REFRESH_TOKEN', access_token: 'SYNTHETIC_ACCESS_TOKEN', scope: 'https://www.googleapis.com/auth/drive.appdata' });
    }
    if (url.endsWith('/revoke') && this.failRevoke) throw new ServiceUnavailableException();
    return Response.json({});
  }
}
function fixture() {
  const f = friendsFixture();
  const config = new ConfigService<Environment, true>(validateEnvironment({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost/native_drive_test', ...settings }));
  return { f, drive: new NativeDriveFixture(f.database as unknown as PrismaService, config) };
}
async function until(check: () => boolean) {
  const end = Date.now() + 3000;
  while (!check()) { if (Date.now() >= end) throw Error('Fixture token exchange did not start'); await new Promise(resolve => setTimeout(resolve, 5)); }
}

test('native Drive exposes only public settings and requires the exact owner and one-use state', async () => {
  const { f, drive } = fixture(); const link = await drive.beginNative('alice');
  assert.equal(link.webClientId, settings.GOOGLE_DRIVE_CLIENT_ID);
  assert.deepEqual(link.scopes, ['https://www.googleapis.com/auth/drive.appdata']);
  assert.ok(!JSON.stringify(link).includes(settings.GOOGLE_DRIVE_CLIENT_SECRET));
  assert.ok(!JSON.stringify(f.state.driveLinks).includes(link.state));
  await assert.rejects(drive.completeNative('bob', link.id, link.state, 'SYNTHETIC_CODE'));
  await assert.rejects(drive.completeNative('alice', link.id, randomBytes(32).toString('base64url'), 'SYNTHETIC_CODE'));
  await assert.rejects(drive.callback(link.state, 'SYNTHETIC_CODE'));
  assert.equal(drive.calls.length, 0);
  await drive.completeNative('alice', link.id, link.state, 'SYNTHETIC_CODE');
  const exchange = drive.calls[0]!.form;
  assert.equal(exchange.get('redirect_uri'), ''); assert.equal(exchange.has('code_verifier'), false);
  assert.equal(exchange.get('client_id'), settings.GOOGLE_DRIVE_CLIENT_ID);
  assert.ok(!JSON.stringify(f.state.driveConnections).includes('SYNTHETIC_REFRESH_TOKEN'));
  assert.deepEqual(await drive.completeNative('alice', link.id, link.state, 'SYNTHETIC_CODE'), { connected: true });
  assert.equal(drive.calls.length, 1);
  await assert.rejects(drive.beginNative('alice'), /Disconnect/);
});

test('browser Drive links retain PKCE and cannot be completed or cancelled through native endpoints', async () => {
  const { drive } = fixture(); const link = await drive.begin('alice'); const url = new URL(link.authorizationUrl);
  const state = url.searchParams.get('state')!;
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  await assert.rejects(drive.completeNative('alice', link.id, state, 'SYNTHETIC_CODE'));
  await assert.rejects(drive.cancelNative('alice', link.id, state));
  assert.equal(drive.calls.length, 0);
  await drive.callback(state, 'SYNTHETIC_CODE');
  assert.equal(drive.calls[0]!.form.get('redirect_uri'), settings.GOOGLE_DRIVE_REDIRECT_URI);
  assert.ok(drive.calls[0]!.form.get('code_verifier'));
});

test('cancelled or expired native states cannot exchange a provider code', async () => {
  const { f, drive } = fixture(); const cancelled = await drive.beginNative('alice');
  await drive.cancelNative('alice', cancelled.id, cancelled.state);
  await assert.rejects(drive.completeNative('alice', cancelled.id, cancelled.state, 'SYNTHETIC_CODE'));
  const expired = await drive.beginNative('alice');
  f.state.driveLinks.find(row => row.id === expired.id)!.expiresAt = new Date(0);
  await assert.rejects(drive.completeNative('alice', expired.id, expired.state, 'SYNTHETIC_CODE'));
  assert.equal(drive.calls.length, 0);
});

test('native cancellation during exchange leaves a durable cleanup token when revocation fails', async () => {
  const { f, drive } = fixture(); const link = await drive.beginNative('alice'); let release!: () => void;
  drive.hold = new Promise(resolve => { release = resolve; }); drive.failRevoke = true;
  const pending = drive.completeNative('alice', link.id, link.state, 'SYNTHETIC_CODE');
  const rejected = assert.rejects(pending);
  await until(() => drive.calls.length === 1);
  await drive.cancelNative('alice', link.id, link.state);
  await assert.rejects(drive.eraseOwner('owner-alice'), /connection is still finishing/i);
  release(); await rejected;
  assert.equal(f.state.driveConnections.length, 0);
  assert.ok(f.state.driveLinks[0]!.encryptedCleanupToken);
  assert.ok(!JSON.stringify(f.state.driveLinks).includes('SYNTHETIC_REFRESH_TOKEN'));
  drive.failRevoke = false; await drive.eraseOwner('owner-alice');
  assert.equal(f.state.driveLinks[0]!.encryptedCleanupToken, null);
});

test('account closure during a native exchange cannot create a Drive connection', async () => {
  const { f, drive } = fixture(); const link = await drive.beginNative('alice'); let release!: () => void;
  drive.hold = new Promise(resolve => { release = resolve; });
  const rejected = assert.rejects(drive.completeNative('alice', link.id, link.state, 'SYNTHETIC_CODE'));
  await until(() => drive.calls.length === 1);
  f.state.users.find(row => row.id === 'owner-alice')!.accountState = 'DELETING';
  release(); await rejected;
  assert.equal(f.state.driveConnections.length, 0);
  assert.ok(drive.calls.some(call => call.url.endsWith('/revoke')));
});

test('native HTTP endpoints authenticate, reject caller-selected ownership and bound grant payloads', async () => {
  const context = await createFriendsTestApp(false, undefined, undefined, 'disabled', settings);
  const service = context.app.get(DriveService); const id = randomUUID(); const state = randomBytes(32).toString('base64url');
  const calls: string[] = [];
  service.completeNative = async subject => { calls.push(subject); return { connected: true }; };
  try {
    for (const path of ['connect', 'complete', 'cancel']) {
      assert.equal((await fetch(context.url + '/backups/drive/native/' + path, { method: 'POST' })).status, 401);
    }
    const send = (body: unknown) => fetch(context.url + '/backups/drive/native/complete', { method: 'POST', headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    for (const body of [{ id, state, code: 'code', ownerId: 'owner-bob' }, { id, state: '', code: 'code' }, { id, state, code: 'x'.repeat(4097) }, { id, state, code: '' }]) assert.equal((await send(body)).status, 400);
    assert.deepEqual(calls, []);
    const response = await send({ id, state, code: 'SYNTHETIC_CODE' });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(calls, ['alice']);
  } finally { await context.app.close(); }
});
