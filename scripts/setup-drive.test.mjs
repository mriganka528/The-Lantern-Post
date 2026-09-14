import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { configureDrive, prepareDriveSettings, checkDriveConfig, DRIVE_CALLBACK } from './setup-drive.mjs';
const require = createRequire(import.meta.url);
const { parse } = require('dotenv');
const { driveSettings } = require('../server/src/backups/drive-config.ts');
const client = () => ({ web: { client_id: '123456-fixture.apps.googleusercontent.com', client_secret: 'SYNTHETIC_OAUTH_SECRET', redirect_uris: [DRIVE_CALLBACK] } });
const source = '# Keep local settings\r\nDATABASE_URL=synthetic-database\r\nCLERK_SECRET_KEY=synthetic-clerk-key\r\nEXPO_PUSH_ENABLED=true\r\n';

test('Drive setup adds all four settings together while preserving unrelated configuration', () => {
  const next = prepareDriveSettings(source, client()); const values = parse(next);
  assert.ok(next.startsWith(source));
  assert.equal(values.GOOGLE_DRIVE_CLIENT_ID, client().web.client_id);
  assert.equal(values.GOOGLE_DRIVE_CLIENT_SECRET, client().web.client_secret);
  assert.equal(values.GOOGLE_DRIVE_REDIRECT_URI, DRIVE_CALLBACK);
  assert.equal(Buffer.from(values.GOOGLE_DRIVE_TOKEN_KEY, 'base64').length, 32);
  assert.ok(driveSettings(values, true));
  assert.equal(prepareDriveSettings(next, client()), next);
});

test('re-importing a rotated OAuth secret keeps the existing encryption key', () => {
  const original = prepareDriveSettings(source, client()); const changed = client();
  changed.web.client_secret = 'SYNTHETIC_ROTATED_SECRET';
  const before = parse(original); const after = parse(prepareDriveSettings(original, changed));
  assert.equal(after.GOOGLE_DRIVE_TOKEN_KEY, before.GOOGLE_DRIVE_TOKEN_KEY);
  assert.equal(after.GOOGLE_DRIVE_CLIENT_SECRET, changed.web.client_secret);
});

test('wrong client types and callbacks are rejected without echoing credential contents', () => {
  for (const credentials of [
    { type: 'service_account', private_key: 'DO_NOT_PRINT_THIS' },
    { installed: { client_secret: 'DO_NOT_PRINT_THIS' } },
    { web: { ...client().web, client_secret: 'DO_NOT_PRINT_THIS\nINJECTED=value' } },
    { web: { ...client().web, client_id: 'DO_NOT_PRINT_THIS' } },
    { web: { ...client().web, redirect_uris: ['http://localhost:3000/backups/drive/callback'] } },
  ]) assert.throws(() => prepareDriveSettings(source, credentials), error => !error.message.includes('DO_NOT_PRINT_THIS'));
});

test('existing client identity or a broken encryption key cannot be silently replaced', () => {
  assert.throws(() => prepareDriveSettings(source + 'GOOGLE_DRIVE_CLIENT_ID=another.apps.googleusercontent.com\n', client()), /another OAuth client/);
  assert.throws(() => prepareDriveSettings(source + 'GOOGLE_DRIVE_TOKEN_KEY=DO_NOT_PRINT_THIS\n', client()), error => /32-byte key/.test(error.message) && !error.message.includes('DO_NOT_PRINT_THIS'));
});

test('invalid callback parsing never includes copied private data in its error', () => {
  const values = parse(prepareDriveSettings(source, client()));
  values.GOOGLE_DRIVE_REDIRECT_URI = 'DO_NOT_PRINT_THIS';
  assert.throws(() => driveSettings(values, true), error => /callback/.test(error.message) && !error.message.includes('DO_NOT_PRINT_THIS'));
  assert.equal(driveSettings({}, true), undefined);
  assert.throws(() => driveSettings({ GOOGLE_DRIVE_REDIRECT_URI: DRIVE_CALLBACK }, true), /all GOOGLE_DRIVE/);
});

test('the file importer preserves the original on invalid input and writes a complete reusable configuration', () => {
  const base = resolve('.cache/drive-setup-tests'); mkdirSync(base, { recursive: true });
  const directory = mkdtempSync(resolve(base, 'case-'));
  const envPath = resolve(directory, '.env'); const credentialsPath = resolve(directory, 'oauth.json');
  writeFileSync(envPath, source); writeFileSync(credentialsPath, JSON.stringify({ type: 'service_account', private_key: 'SYNTHETIC_PRIVATE_KEY' }));
  assert.throws(() => configureDrive({ envPath, credentialsPath })); assert.equal(readFileSync(envPath, 'utf8'), source);
  writeFileSync(credentialsPath, JSON.stringify(client())); configureDrive({ envPath, credentialsPath });
  const saved = readFileSync(envPath, 'utf8');
  assert.deepEqual(checkDriveConfig(envPath), { redirectUri: DRIVE_CALLBACK });
  configureDrive({ envPath, credentialsPath }); assert.equal(readFileSync(envPath, 'utf8'), saved);
});
