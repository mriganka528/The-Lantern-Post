import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configureApi, HOSTED_API } from './configure-api.mjs';

function fixture() {
  const base = resolve('.cache/api-settings-tests'); mkdirSync(base, { recursive: true });
  const root = mkdtempSync(resolve(base, 'case-')); mkdirSync(resolve(root, 'client')); mkdirSync(resolve(root, 'server'));
  writeFileSync(resolve(root, 'client/.env'), '# Keep this comment\r\nEXPO_PUBLIC_API_URL=http://localhost:3000\r\nEXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_fixture\r\nEXPO_PUBLIC_EAS_PROJECT_ID=fixture-project\r\n');
  writeFileSync(resolve(root, 'server/.env'), 'DATABASE_URL=synthetic-database\nCLERK_SECRET_KEY=synthetic-secret\nWEB_ORIGINS=https://api.example.com\n');
  return { root, client: () => readFileSync(resolve(root, 'client/.env'), 'utf8'), server: () => readFileSync(resolve(root, 'server/.env'), 'utf8') };
}

test('hosted selection preserves credentials and unrelated settings and is idempotent', () => {
  const f = fixture(); const server = f.server();
  assert.deepEqual(configureApi({ root: f.root, mode: 'hosted' }), { native: HOSTED_API, web: HOSTED_API, local: false });
  assert.match(f.client(), /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_fixture\r\n/);
  assert.match(f.client(), /EXPO_PUBLIC_EAS_PROJECT_ID=fixture-project\r\n/);
  assert.ok(f.client().startsWith('# Keep this comment\r\n'));
  assert.equal(f.server(), server);
  const first = f.client(); configureApi({ root: f.root, mode: 'hosted' }); assert.equal(f.client(), first);
});

test('local phone selection adds exact socket/preview origins without changing server credentials', () => {
  const f = fixture(); const originalServer = f.server();
  const result = configureApi({ root: f.root, mode: 'local', url: 'http://192.168.29.181:3000' });
  assert.equal(result.web, result.native);
  assert.ok(f.server().startsWith(originalServer));
  assert.match(f.server(), /DEVELOPMENT_WEB_ORIGINS=.*http:\/\/192\.168\.29\.181:3000.*http:\/\/192\.168\.29\.181:8081/);
  configureApi({ root: f.root, mode: 'hosted' });
  assert.match(f.client(), /EXPO_PUBLIC_WEB_API_URL=https:\/\/the-lantern-post\.onrender\.com/);
});

test('invalid endpoint selection fails before changing either settings file', () => {
  const f = fixture(); const client = f.client(); const server = f.server();
  for (const input of [
    { mode: 'local', url: 'http://public.example' },
    { mode: 'local', url: 'http://user:secret@localhost:3000' },
    { mode: 'local', url: 'http://localhost:3000', webUrl: 'http://public.example' },
    { mode: 'hosted', url: 'http://api.example.com' },
    { mode: 'hosted', url: 'https://api.example.com?token=secret' },
    { mode: 'automatic' },
  ]) assert.throws(() => configureApi({ root: f.root, ...input }));
  assert.equal(f.client(), client); assert.equal(f.server(), server);
});
