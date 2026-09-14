import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateEnvironment } from '../src/config/environment';

const base = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://local:local@localhost:5432/lantern-post' };
const publishableKey = `pk_test_${Buffer.from('test.clerk.accounts.dev$').toString('base64')}`;
const auth = { CLERK_PUBLISHABLE_KEY: publishableKey, CLERK_SECRET_KEY: 'sk_test_localfixture' };

test('development/test can boot health routes without configured authentication', () => {
  const environment = validateEnvironment(base);
  assert.equal(environment.CLERK_ISSUER, undefined);
  assert.equal(environment.CLERK_SECRET_KEY, undefined);
  assert.deepEqual(environment.CLERK_AUTHORIZED_PARTIES, []);
});

test('production requires normal Clerk keys, without a manually supplied issuer or JWT key', () => {
  assert.throws(() => validateEnvironment({ ...base, NODE_ENV: 'production' }), /required in production/);
  assert.throws(() => validateEnvironment({ ...base, NODE_ENV: 'production', CLERK_PUBLISHABLE_KEY: publishableKey }), /required in production/);
  const environment = validateEnvironment({ ...base, ...auth, NODE_ENV: 'production' });
  assert.equal(environment.CLERK_ISSUER, 'https://test.clerk.accounts.dev');
  assert.equal(environment.CLERK_SECRET_KEY, auth.CLERK_SECRET_KEY);
});

test('the trusted issuer is derived from server configuration and rejects malformed public keys', () => {
  assert.equal(validateEnvironment({ ...base, ...auth, CLERK_ISSUER: 'https://untrusted.example' }).CLERK_ISSUER, 'https://test.clerk.accounts.dev');
  for (const hostname of ['https://test.clerk.accounts.dev$', 'user:password@test.clerk.accounts.dev$', 'test.clerk.accounts.dev/path$', 'test.clerk.accounts.dev?query$']) {
    const key = `pk_test_${Buffer.from(hostname).toString('base64')}`;
    assert.throws(() => validateEnvironment({ ...base, ...auth, CLERK_PUBLISHABLE_KEY: key }), /CLERK_PUBLISHABLE_KEY/);
  }
});

test('normal Clerk configuration preserves exact authorized parties and checks key modes', () => {
  const environment = validateEnvironment({ ...base, ...auth, CLERK_AUTHORIZED_PARTIES: 'https://allowed.example, https://allowed.example' });
  assert.deepEqual(environment.CLERK_AUTHORIZED_PARTIES, ['https://allowed.example']);
  assert.throws(() => validateEnvironment({ ...base, ...auth, CLERK_SECRET_KEY: 'sk_live_fixture' }), /same test\/live mode/);
});

test('misplaced and invalid Clerk keys are rejected without printing their values', () => {
  for (const value of ['invalid-secret', publishableKey]) {
    assert.throws(() => validateEnvironment({ ...base, ...auth, CLERK_SECRET_KEY: value }), (error: unknown) =>
      error instanceof Error && error.message.includes('CLERK_SECRET_KEY') && !error.message.includes(value));
  }
  assert.throws(() => validateEnvironment({ ...base, ...auth, CLERK_PUBLISHABLE_KEY: auth.CLERK_SECRET_KEY }), /publishable key/);
});

test('browser preview permits exact local origins while production requires explicit HTTPS origins', () => {
  assert.deepEqual(validateEnvironment(base).WEB_ORIGINS, ['http://localhost:8081', 'http://127.0.0.1:8081']);
  assert.deepEqual(validateEnvironment({ ...base, ...auth, NODE_ENV: 'production' }).WEB_ORIGINS, []);
  assert.deepEqual(validateEnvironment({ ...base, ...auth, NODE_ENV: 'production', WEB_ORIGINS: 'https://app.example.com/,https://app.example.com' }).WEB_ORIGINS, ['https://app.example.com']);
  for (const origin of ['*', 'https://app.example.com/path', 'https://user:secret@app.example.com', 'http://app.example.com']) {
    assert.throws(() => validateEnvironment({ ...base, WEB_ORIGINS: origin }), /WEB_ORIGINS/);
  }
  assert.throws(() => validateEnvironment({ ...base, ...auth, NODE_ENV: 'production', WEB_ORIGINS: 'http://localhost:8081' }), /WEB_ORIGINS/);
});

test('voice storage is optional and partial configuration fails without exposing credentials', () => {
  assert.equal(validateEnvironment(base).VOICE_STORAGE, undefined);
  assert.throws(() => validateEnvironment({ ...base, VOICE_STORAGE_SECRET_ACCESS_KEY: 'never-show-this-secret' }), error => error instanceof Error && /all VOICE_STORAGE/.test(error.message) && !error.message.includes('never-show'));
});
test('automated moderation defaults off in development and production and an explicit future required mode validates',()=>{
  assert.equal(validateEnvironment(base).MODERATION_MODE,'disabled');assert.equal(validateEnvironment({...base,...auth,NODE_ENV:'production'}).MODERATION_MODE,'disabled');assert.equal(validateEnvironment({...base,MODERATION_MODE:'required'}).MODERATION_MODE,'required');assert.throws(()=>validateEnvironment({...base,MODERATION_MODE:'allow-everything'}),/MODERATION_MODE/);
});
test('voice storage accepts trusted private endpoints and rejects insecure or credential-bearing locations', () => {
  const storage = { VOICE_STORAGE_ENDPOINT: 'https://objects.example.invalid', VOICE_STORAGE_BUCKET: 'lantern-private', VOICE_STORAGE_REGION: 'auto', VOICE_STORAGE_ACCESS_KEY_ID: 'fixture-id', VOICE_STORAGE_SECRET_ACCESS_KEY: 'fixture-secret' };
  assert.equal(validateEnvironment({ ...base, ...storage }).VOICE_STORAGE?.bucket, 'lantern-private');
  assert.equal(validateEnvironment({ ...base, ...storage, VOICE_STORAGE_ENDPOINT: 'http://127.0.0.1:9000' }).VOICE_STORAGE?.endpoint, 'http://127.0.0.1:9000');
  for (const endpoint of ['invalid-fixture-secret', 'https://user:fixture-secret@objects.example.invalid', 'https://objects.example.invalid/path', 'http://objects.example.invalid', 'https://objects.example.invalid?key=fixture-secret']) {
    assert.throws(() => validateEnvironment({ ...base, ...storage, VOICE_STORAGE_ENDPOINT: endpoint }), error => error instanceof Error && /VOICE_STORAGE/.test(error.message) && !error.message.includes('fixture-secret'));
  }
  assert.throws(() => validateEnvironment({ ...base, ...auth, ...storage, NODE_ENV: 'production', VOICE_STORAGE_ENDPOINT: 'http://127.0.0.1:9000' }), /VOICE_STORAGE/);
});
