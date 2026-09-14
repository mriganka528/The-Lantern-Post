import { AccountAccess } from '../src/account/account-access';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { verifyToken } from '@clerk/backend';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';
import { UsersModule } from '../src/users/users.module';
import { CLERK_VERIFY_TOKEN } from '../src/auth/clerk-token-verifier.service';
import type { VerifyClerkToken } from '../src/auth/clerk-token-verifier.service';

const issuer = 'https://test.clerk.accounts.dev';
const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const secretKey = 'sk_test_localfixture';
const publishableKey = `pk_test_${Buffer.from('test.clerk.accounts.dev$').toString('base64')}`;
const environment = validateEnvironment({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost:5432/test', WEB_ORIGINS: 'https://api.example.com', DEVELOPMENT_WEB_ORIGINS: 'http://localhost:8081', CLERK_PUBLISHABLE_KEY: publishableKey, CLERK_SECRET_KEY: secretKey, CLERK_AUTHORIZED_PARTIES: 'https://allowed.example' });
const config = new ConfigService(environment);
let keyRequests = 0;
let keyServiceAvailable = true;
const keyService = createServer((request, response) => {
  keyRequests++;
  response.setHeader('Content-Type', 'application/json');
  if (request.url !== '/v1/jwks' || request.headers.authorization !== `Bearer ${secretKey}`) {
    response.writeHead(401).end(JSON.stringify({ errors: [{ code: 'clerk_key_invalid', message: 'Invalid fixture key' }] }));
  } else if (!keyServiceAvailable) {
    response.writeHead(503).end(JSON.stringify({ errors: [{ code: 'unavailable', message: 'Fixture key service unavailable' }] }));
  } else {
    response.end(JSON.stringify({ keys: [{ ...pair.publicKey.export({ format: 'jwk' }), kid: 'local-test-key', alg: 'RS256', use: 'sig' }] }));
  }
});
const reads: string[] = [];
const rows = new Map<string, { id: string; username: string; characterId: null; palaceTheme: null; createdAt: Date }>();
let app: INestApplication;
let baseUrl: string;

function token(overrides: Record<string, unknown> = {}, privateKey = pair.privateKey): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'local-test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ v: 2, iss: issuer, sub: 'user_alice', sid: 'sess_alice', iat: now, nbf: now - 1, exp: now + 60, ...overrides })).toString('base64url');
  const message = `${header}.${payload}`;
  return `${message}.${sign('RSA-SHA256', Buffer.from(message), privateKey).toString('base64url')}`;
}

before(async () => {
  await new Promise<void>((resolve) => keyService.listen(0, '127.0.0.1', resolve));
  const address = keyService.address();
  if (!address || typeof address === 'string') throw new Error('Fixture key server did not start');
  const verifyFromLocalKeyService: VerifyClerkToken = (credential, options) => verifyToken(credential, {
    ...options, apiUrl: `http://127.0.0.1:${address.port}`, skipJwksCache: true,
  });
  const module = await Test.createTestingModule({ imports: [UsersModule] })
    .overrideProvider(AccountAccess).useValue({assertSubject: async () => {}})
    .overrideProvider(ConfigService).useValue(config)
    .overrideProvider(CLERK_VERIFY_TOKEN).useValue(verifyFromLocalKeyService)
    .overrideProvider(PrismaService).useValue({ accountDeletion: {findUnique: async () => null}, $transaction: function(work: (tx: unknown) => Promise<unknown>) {return work(this);}, user: {
      findUnique: async ({ where }: { where: { authProviderId?: string; username?: string } }) => {
        if (where.authProviderId) { reads.push(where.authProviderId); return rows.get(where.authProviderId) ?? null; }
        return [...rows.values()].find((row) => row.username === where.username) ?? null;
      },
      create: async ({ data }: { data: { authProviderId: string; username: string } }) => {
        if (rows.has(data.authProviderId) || [...rows.values()].some((row) => row.username === data.username)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique constraint', { code: 'P2002', clientVersion: '6.19.3' });
        }
        const row = { id: `local-${rows.size + 1}`, username: data.username, characterId: null, palaceTheme: null, createdAt: new Date() };
        rows.set(data.authProviderId, row);
        return row;
      },
    } }).compile();
  app = module.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});

after(async () => {
  await app?.close();
  await new Promise<void>((resolve, reject) => keyService.close((error) => error ? reject(error) : resolve()));
});

test('all identity endpoints reject unauthenticated access before reading the database', async () => {
  const beforeReads = reads.length;
  for (const [path, method] of [['/users/me', 'GET'], ['/users/me', 'POST'], ['/users/username-availability?username=fox', 'GET']]) {
    const response = await fetch(`${baseUrl}${path}`, { method });
    assert.equal(response.status, 401);
  }
  assert.equal(reads.length, beforeReads);
});

test('a real SDK-verified session can read only its own profile, ignoring supplied identity parameters', async () => {
  const response = await fetch(`${baseUrl}/users/me?authProviderId=user_victim`, { headers: { Authorization: `Bearer ${token()}` } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { user: null });
  assert.equal(reads.at(-1), 'user_alice');
  assert.ok(keyRequests > 0, 'Clerk SDK must retrieve its signing key using the server secret');
});

test('invalid signatures, expiry, issuer, session type, pending sessions, and authorized parties are rejected', async () => {
  const otherPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const invalid = [
    token({}, otherPair.privateKey), token({ exp: 1 }), token({ iss: 'https://other.clerk.accounts.dev' }),
    token({ sid: null }), token({ sub: 'machine_identity' }), token({ sts: 'pending' }), token({ azp: 'https://untrusted.example' }),
  ];
  for (const credential of invalid) {
    const response = await fetch(`${baseUrl}/users/me`, { headers: { Authorization: `Bearer ${credential}` } });
    assert.equal(response.status, 401);
    assert.ok(!(await response.text()).includes(credential));
  }
  const allowed = await fetch(`${baseUrl}/users/me`, { headers: { Authorization: `Bearer ${token({ azp: 'https://allowed.example' })}` } });
  assert.equal(allowed.status, 200);
});

test('token payload modification and multiple bearer credentials cannot bypass verification', async () => {
  const original = token();
  const [header, , signature] = original.split('.');
  const tampered = `${header}.${Buffer.from(JSON.stringify({ iss: issuer, sub: 'user_victim', sid: 'sess_victim', exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url')}.${signature}`;
  for (const value of [`Bearer ${tampered}`, `Bearer ${original}, Bearer ${original}`, original]) {
    assert.equal((await fetch(`${baseUrl}/users/me`, { headers: { Authorization: value } })).status, 401);
  }
});

test('onboarding rejects spoofed identities, missing age confirmation, and invalid usernames', async () => {
  for (const body of [
    { username: 'lantern_fox', minimumAgeConfirmed: true, authProviderId: 'user_victim' },
    { username: 'lantern_fox', minimumAgeConfirmed: false }, { username: 'lantern_fox', minimumAgeConfirmed: 'true' },
    { username: 'ab', minimumAgeConfirmed: true }, { username: 'letter with spaces', minimumAgeConfirmed: true },
    { username: 'éclair', minimumAgeConfirmed: true }, { username: 'x'.repeat(25), minimumAgeConfirmed: true },
  ]) {
    const response = await fetch(`${baseUrl}/users/me`, { method: 'POST', headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 400);
  }
  assert.equal(rows.size, 0);
});

test('first onboarding normalizes the username, retries safely, and prevents case-variant duplicate accounts', async () => {
  const create = (credential: string, username: string) => fetch(`${baseUrl}/users/me`, { method: 'POST', headers: { Authorization: `Bearer ${credential}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, minimumAgeConfirmed: true }) });
  const first = await create(token(), ' Lantern_Fox ');
  assert.equal(first.status, 200);
  const result = await first.json() as { user: { id: string; username: string } };
  assert.equal(result.user.username, 'lantern_fox');
  assert.ok(!JSON.stringify(result).includes('user_alice'));
  assert.equal((await create(token(), 'LANTERN_FOX')).status, 200);
  assert.equal(rows.size, 1);
  assert.equal((await create(token({ sub: 'user_bob', sid: 'sess_bob' }), 'LANTERN_FOX')).status, 409);
  assert.equal((await create(token(), 'changed_name')).status, 409);
  const availability = await fetch(`${baseUrl}/users/username-availability?username=LANTERN_FOX`, { headers: { Authorization: `Bearer ${token()}` } });
  assert.deepEqual(await availability.json(), { username: 'lantern_fox', available: false });
});

test('missing Clerk configuration fails closed without querying a profile', async () => {
  const beforeReads = reads.length;
  // ConfigService.set(undefined) writes the literal string "undefined" to
  // process.env. An empty value represents the unconfigured development case.
  config.set('CLERK_SECRET_KEY', '');
  try {
    const response = await fetch(`${baseUrl}/users/me`, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(response.status, 503);
    assert.equal(reads.length, beforeReads);
  } finally { config.set('CLERK_SECRET_KEY', secretKey); }
});

test('browser preflight allows the preview origin and bearer header without enabling cookies', async () => {
  const response = await fetch(`${baseUrl}/users/me`, { method: 'OPTIONS', headers: {
    Origin: 'http://localhost:8081',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'authorization,content-type',
  } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
  assert.match(response.headers.get('Access-Control-Allow-Headers') ?? '', /authorization/i);
  assert.equal(response.headers.get('Access-Control-Allow-Credentials'), null);
  const denied = await fetch(`${baseUrl}/users/me`, { method: 'OPTIONS', headers: {
    Origin: 'https://untrusted.example', 'Access-Control-Request-Method': 'POST',
  } });
  assert.equal(denied.headers.get('Access-Control-Allow-Origin'), null);
});

test('a Clerk token issued to the configured browser preview origin is accepted', async () => {
  const response = await fetch(`${baseUrl}/users/me`, { headers: {
    Origin: 'http://localhost:8081', Authorization: `Bearer ${token({ azp: 'http://localhost:8081' })}`,
  } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'http://localhost:8081');
});

test('a signing-key service outage fails closed without reading profile data', async () => {
  const beforeReads = reads.length;
  keyServiceAvailable = false;
  try {
    const response = await fetch(`${baseUrl}/users/me`, { headers: { Authorization: `Bearer ${token()}` } });
    assert.equal(response.status, 503);
    assert.equal(reads.length, beforeReads);
    assert.ok(!(await response.text()).includes(secretKey));
  } finally { keyServiceAvailable = true; }
});
