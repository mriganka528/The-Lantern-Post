import { AccountAccess } from '../src/account/account-access';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ClerkTokenVerifier } from '../src/auth/clerk-token-verifier.service';
import { CharactersModule } from '../src/characters/characters.module';
import { characterKeys, characterStories } from '../src/characters/catalog';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';
import { PrismaService } from '../src/database/prisma.service';

const catalog = characterKeys.map((key, i) => ({ id: `char_${i}`, key, displayName: `Companion ${i}`, assetUrl: `bundled://characters/${key}`, isActive: true, privateField: 'not-public' }));
type Row = { id: string; authProviderId: string; username: string; characterId: string | null; palaceTheme: string | null; createdAt: Date };
const users = new Map<string, Row>();
let databaseCalls = 0;
let failUpdate = false;
const database = {
  user: {
    findUnique: async ({ where, select }: { where: { authProviderId: string }; select?: { character?: unknown } }) => {
      databaseCalls++;
      const user = users.get(where.authProviderId);
      return user ? { ...user, ...(select?.character ? { character: catalog.find(row => row.id === user.characterId) ?? null } : {}) } : null;
    },
    update: async ({ where, data }: { where: { authProviderId: string }; data: { characterId: string; palaceTheme: string } }) => {
      databaseCalls++;
      if (failUpdate) throw new Error('private database error');
      const row = users.get(where.authProviderId);
      assert.ok(row, 'Only an existing authenticated account can be updated');
      Object.assign(row, data);
      return { ...row };
    },
  },
  character: {
    findMany: async ({ where }: { where: { isActive: boolean; key: { in: string[] } } }) => {
      databaseCalls++;
      return catalog.filter(row => row.isActive === where.isActive && where.key.in.includes(row.key)).toReversed();
    },
    findUnique: async ({ where }: { where: { id: string } }) => { databaseCalls++; return catalog.find(row => row.id === where.id) ?? null; },
  },
};
let app: INestApplication;
let url: string;

before(async () => {
  const config = new ConfigService(validateEnvironment({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/test' }));
  const module = await Test.createTestingModule({ imports: [CharactersModule] })
    .overrideProvider(AccountAccess).useValue({assertSubject: async () => {}})
    .overrideProvider(ConfigService).useValue(config)
    .overrideProvider(PrismaService).useValue({ ...database, $transaction: (operation: (transaction: typeof database) => Promise<unknown>) => operation(database) })
    .overrideProvider(ClerkTokenVerifier).useValue({ verify: async (token: string) => {
      if (!['alice', 'bob', 'new-user'].includes(token)) throw new UnauthorizedException();
      return { subject: token, sessionId: `session-${token}` };
    } })
    .compile();
  app = module.createNestApplication({ logger: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  url = await app.getUrl();
});
beforeEach(() => {
  users.clear();
  for (const name of ['alice', 'bob']) users.set(name, { id: `user-${name}`, authProviderId: name, username: `${name}_post`, characterId: null, palaceTheme: null, createdAt: new Date('2026-09-12T00:00:00Z') });
  catalog.forEach(row => { row.isActive = true; });
  databaseCalls = 0;
  failUpdate = false;
});
after(async () => { await app?.close(); });

const request = (path: string, token?: string, body?: unknown) => fetch(`${url}${path}`, {
  method: body === undefined ? 'GET' : 'POST',
  headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

test('catalog, palace, and selection require authentication before any database operation', async () => {
  for (const token of [undefined, 'forged']) {
    assert.equal((await request('/characters', token)).status, 401);
    assert.equal((await request('/users/me/palace', token)).status, 401);
    assert.equal((await request('/users/me/character', token, { characterId: 'char_0' })).status, 401);
  }
  assert.equal(databaseCalls, 0);
});

test('catalog returns all curated companions in order and filters inactive choices', async () => {
  const response = await request('/characters', 'alice');
  assert.equal(response.status, 200);
  const body = await response.json() as { characters: { key: string }[] };
  assert.deepEqual(body.characters.map(row => row.key), characterKeys);
  assert.ok(!JSON.stringify(body).includes('privateField'));
  assert.ok(!JSON.stringify(body).includes('isActive'));
  catalog[0]!.isActive = false;
  const reduced = await (await request('/characters', 'alice')).json() as { characters: { key: string }[] };
  assert.equal(reduced.characters.length, characterKeys.length - 1);
});

test('selection rejects extra identity/theme fields, invalid IDs, and accounts without a username', async () => {
  for (const body of [
    {}, { characterId: '' }, { characterId: ['char_0'] }, { characterId: 'x'.repeat(65) },
    { characterId: 'char_0', authProviderId: 'bob' }, { characterId: 'char_0', palaceTheme: 'forged-theme' }, { characterId: 'char_0', userId: 'user-bob' },
  ]) assert.equal((await request('/users/me/character', 'alice', body)).status, 400);
  assert.equal(databaseCalls, 0);
  assert.equal((await request('/users/me/character', 'new-user', { characterId: 'char_0' })).status, 409);
  assert.equal((await request('/users/me/palace', 'new-user')).status, 409);
  assert.equal(users.size, 2);
});

test('unknown and inactive companions cannot be assigned, leaving both account fields untouched', async () => {
  catalog[1]!.isActive = false;
  for (const characterId of ['missing', 'char_1']) {
    const response = await request('/users/me/character', 'alice', { characterId });
    assert.equal(response.status, 404);
    assert.equal((await response.json() as { code: string }).code, 'CHARACTER_UNAVAILABLE');
  }
  assert.equal(users.get('alice')!.characterId, null);
  assert.equal(users.get('alice')!.palaceTheme, null);
});

test('selection persists only for the verified owner, saves a matching theme, and retries safely', async () => {
  assert.deepEqual(await (await request('/users/me/palace', 'alice')).json(), { character: null });
  const first = await request('/users/me/character?authProviderId=bob', 'alice', { characterId: 'char_0' });
  assert.equal(first.status, 200);
  const saved = await first.json() as { user: { characterId: string; palaceTheme: string } };
  assert.equal(saved.user.characterId, 'char_0');
  assert.equal(saved.user.palaceTheme, 'amber-hollow');
  assert.ok(!JSON.stringify(saved).includes('authProviderId'));
  const repeated = await request('/users/me/character', 'alice', { characterId: 'char_0' });
  assert.deepEqual(await repeated.json(), saved);
  assert.equal(users.get('bob')!.characterId, null);
  const palace = await (await request('/users/me/palace?authProviderId=bob', 'alice')).json() as { character: { id: string; palace: { theme: string } } };
  assert.equal(palace.character.id, 'char_0');
  assert.equal(palace.character.palace.theme, 'amber-hollow');
  assert.deepEqual(await (await request('/users/me/palace', 'bob')).json(), { character: null });
});

test('changing companions replaces the pair and retiring a companion preserves its existing palace', async () => {
  await request('/users/me/character', 'alice', { characterId: 'char_0' });
  const changed = await request('/users/me/character', 'alice', { characterId: 'char_2' });
  assert.equal(changed.status, 200);
  assert.equal(users.get('alice')!.palaceTheme, 'starlight-library');
  catalog[2]!.isActive = false;
  const response = await request('/users/me/palace', 'alice');
  assert.equal(response.status, 200);
  assert.equal((await response.json() as { character: { id: string } }).character.id, 'char_2');
});

test('simultaneous choices leave a valid companion/theme pair and an outage is never reported as success', async () => {
  const responses = await Promise.all(['char_0', 'char_5'].map(characterId => request('/users/me/character', 'alice', { characterId })));
  assert.ok(responses.every(response => response.status === 200));
  const row = users.get('alice')!;
  const character = catalog.find(character => character.id === row.characterId)!;
  assert.equal(row.palaceTheme, characterStories[character.key].palace.theme);
  const before = { ...row };
  failUpdate = true;
  const failed = await request('/users/me/character', 'alice', { characterId: 'char_2' });
  assert.equal(failed.status, 500);
  assert.ok(!(await failed.text()).includes('private database error'));
  assert.deepEqual(users.get('alice'), before);
});

test('OpenAPI describes the character and palace response contracts', async () => {
  const document = await (await fetch(`${url}/docs-json`)).json() as { paths: Record<string, unknown> };
  for (const path of ['/characters', '/users/me/palace', '/users/me/character']) assert.ok(document.paths[path]);
});
