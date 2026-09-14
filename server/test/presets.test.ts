import { AccountAccess } from '../src/account/account-access';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ClerkTokenVerifier } from '../src/auth/clerk-token-verifier.service';
import { PresetsModule } from '../src/presets/presets.module';
import { serializePreset } from '../src/presets/preset';
import { PrismaService } from '../src/database/prisma.service';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';

const config = { version: 1, order: 1, description: 'A little moonlight.', paperColor: '#F0EDF6', inkColor: '#51465E', sealColor: '#817096', ribbonColor: '#B1A7C3', texture: 'vellum', motif: 'stars', font: 'book', privateField: 'do-not-return' };
const row = { id: 'preset_moon', key: 'moonflower', displayName: 'Moonflower', configJson: config, isActive: true, privateField: 'do-not-return' };
const rows = [row, { ...row, id: 'inactive', isActive: false }, { ...row, id: 'unsupported', configJson: { ...config, version: 2 } }, { ...row, id: 'first', key: 'first', configJson: { ...config, order: 0 } }];
let app: INestApplication;
let url: string;
let calls = 0;
let outage = false;
before(async () => {
  const module = await Test.createTestingModule({ imports: [PresetsModule] })
    .overrideProvider(AccountAccess).useValue({assertSubject: async () => {}})
    .overrideProvider(ConfigService).useValue(new ConfigService(validateEnvironment({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/test' })))
    .overrideProvider(ClerkTokenVerifier).useValue({ verify: async (token: string) => {
      if (token !== 'valid-fixture') throw new UnauthorizedException();
      return { subject: 'fixture-owner', sessionId: 'fixture-session' };
    } })
    .overrideProvider(PrismaService).useValue({ preset: { findMany: async ({ where }: { where: { isActive: boolean } }) => {
      calls++;
      if (outage) throw new Error('private connection details');
      return rows.filter(value => value.isActive === where.isActive);
    } } }).compile();
  app = module.createNestApplication({ logger: false }); configureApp(app);
  await app.listen(0, '127.0.0.1'); url = await app.getUrl();
});
after(async () => { await app?.close(); });

test('stationery requires a verified session before querying the catalog', async () => {
  const initial = calls;
  assert.equal((await fetch(`${url}/presets`)).status, 401);
  assert.equal((await fetch(`${url}/presets`, { headers: { Authorization: 'Bearer forged' } })).status, 401);
  assert.equal(calls, initial);
});
test('only active supported presets are returned, in order, without raw configuration metadata', async () => {
  const response = await fetch(`${url}/presets`, { headers: { Authorization: 'Bearer valid-fixture' } });
  assert.equal(response.status, 200);
  const result = await response.json() as { presets: { id: string; config: object }[] };
  assert.deepEqual(result.presets.map(p => p.id), ['first', 'preset_moon']);
  assert.ok(!JSON.stringify(result).includes('do-not-return'));
  assert.ok(!JSON.stringify(result).includes('isActive'));
  assert.ok(!JSON.stringify(result).includes('configJson'));
});
test('malformed palette values and unsupported configuration cannot become client styles', () => {
  for (const bad of [null, [], { ...config, paperColor: 'url(https://untrusted.invalid)' }, { ...config, order: -1 }, { ...config, texture: 'remote' }, { ...config, texture: ['linen'] }, { ...config, font: 'url(font)' }]) {
    assert.equal(serializePreset({ ...row, configJson: bad }), null);
  }
});
test('a database failure is a safe error and the stationery endpoint does not accept letters', async () => {
  outage = true;
  try {
    const response = await fetch(`${url}/presets`, { headers: { Authorization: 'Bearer valid-fixture' } });
    assert.equal(response.status, 500); assert.ok(!(await response.text()).includes('private connection'));
  } finally { outage = false; }
  assert.equal((await fetch(`${url}/presets`, { method: 'POST', headers: { Authorization: 'Bearer valid-fixture', 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'This letter must not be stored here.' }) })).status, 404);
});
