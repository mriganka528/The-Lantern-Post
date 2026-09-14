import { AccountAccess } from '../src/account/account-access';
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import { UnauthorizedException } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import type { BurnLetterRequest, BurnReceipt } from '@lantern-post/shared-types';
import { LettersModule } from '../src/letters/letters.module';
import { ClerkTokenVerifier } from '../src/auth/clerk-token-verifier.service';
import { PrismaService } from '../src/database/prisma.service';
import { configureApp } from '../src/configure-app';
import { validateEnvironment } from '../src/config/environment';
import { RequestLimits } from '../src/safety/request-limits';
import { friendsFixture } from './friends-fixture';
const budgetFixture = friendsFixture();

type ReceiptRow = { id: string; ownerId: string; outcome: 'BURNED' | 'REJECTED'; reason: string | null; letterId: string | null; createdAt: Date };
let receipts = new Map<string, ReceiptRow>();
let letters = new Map<string, Record<string, unknown>>();
let calls = 0; let active = true; let failReceipt = false;
const configJson = { version: 1, order: 0, description: 'A fixture page.', paperColor: '#F0DDB5', inkColor: '#493622', sealColor: '#874B36', ribbonColor: '#899069', texture: 'parchment', motif: 'postmark', font: 'book' };
const writes: unknown[] = [];
let queue: Promise<void> = Promise.resolve();
const conflict = () => new Prisma.PrismaClientKnownRequestError('Fixture uniqueness conflict', { code: 'P2002', clientVersion: '6.19.3' });
const database = {
  user: { findUnique: async ({ where }: { where: { authProviderId: string } }) => {
    calls++; return ['alice', 'bob', 'no-character'].includes(where.authProviderId) ? { id: `owner-${where.authProviderId}`, characterId: where.authProviderId === 'no-character' ? null : 'char_fox_lantern' } : null;
  } },
  burnReceipt: { findUnique: async ({ where }: { where: { id: string } }) => { calls++; return receipts.get(where.id) ?? null; } },
  $transaction: async (operation: (tx: ReturnType<typeof transactionModels>) => Promise<unknown>) => {
    let release: () => void = () => {};
    const previous = queue; queue = new Promise(resolve => { release = resolve; }); await previous;
    const transactionReceipts = new Map(receipts); const transactionLetters = new Map(letters);
    try { const result = await operation(transactionModels(transactionReceipts, transactionLetters)); receipts = transactionReceipts; letters = transactionLetters; return result; }
    finally { release(); }
  },
};
function transactionModels(r: Map<string, ReceiptRow>, l: Map<string, Record<string, unknown>>) {
  return {
    user: {findFirst: async () => ({id:'active-test-user'})},
    preset: { findUnique: async ({ where }: { where: { id: string } }) => where.id === 'preset_lantern' ? { id: where.id, key: 'lantern-parchment', displayName: 'Lantern parchment', configJson, isActive: active } : null },
    letter: { create: async ({ data }: { data: Record<string, unknown> & { id: string } }) => {
      writes.push(data); if (l.has(data.id)) throw conflict(); l.set(data.id, data); return { id: data.id };
    } },
    burnReceipt: { create: async ({ data }: { data: Pick<ReceiptRow, 'id' | 'ownerId' | 'outcome'> & Partial<ReceiptRow> }) => {
      writes.push(data); if (failReceipt) throw new Error('private database failure'); if (r.has(data.id)) throw conflict();
      const row: ReceiptRow = { reason: null, letterId: null, createdAt: new Date(), ...data }; r.set(data.id, row); return { ...row, privateField: 'must-not-leak' };
    } },
  };
}
let app: INestApplication; let url: string;
before(async () => {
  const module = await Test.createTestingModule({ imports: [LettersModule] })
    .overrideProvider(AccountAccess).useValue({assertSubject: async () => {}})
    .overrideProvider(ConfigService).useValue(new ConfigService(validateEnvironment({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://localhost:5432/test' })))
    .overrideProvider(PrismaService).useValue(database)
    .overrideProvider(RequestLimits).useValue(new RequestLimits(budgetFixture.database as unknown as PrismaService))
    .overrideProvider(ClerkTokenVerifier).useValue({ verify: async (token: string) => {
      if (!['alice', 'bob', 'new-user', 'no-character'].includes(token)) throw new UnauthorizedException(); return { subject: token, sessionId: `session-${token}` };
    } }).compile();
  app = module.createNestApplication({ logger: false }); configureApp(app); await app.listen(0, '127.0.0.1'); url = await app.getUrl();
});
beforeEach(() => { budgetFixture.reset(); receipts.clear(); letters.clear(); writes.length = 0; calls = 0; active = true; failReceipt = false; });
after(async () => { await app?.close(); });
const body = (): BurnLetterRequest => ({ requestId: randomUUID(), type: 'TEXT', destinationType: 'BURNING', textContent: 'Synthetic private words that must never persist.', presetId: 'preset_lantern', burnConfirmed: true });
const send = (input: unknown, token = 'alice') => fetch(`${url}/letters`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(input) });
const lookup = (requestId: string, token = 'alice') => fetch(`${url}/letters/burning/requests/${requestId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

test('burn and receipt endpoints reject unauthenticated access before touching the database', async () => {
  assert.equal((await send(body(), '')).status, 401); assert.equal((await send(body(), 'forged')).status, 401);
  assert.equal((await lookup(randomUUID(), '')).status, 401); assert.equal(calls, 0);
});
test('only explicitly confirmed, valid text burns are accepted, without client-supplied identity or destinations', async () => {
  const valid = body();
  for (const input of [
    {}, { ...valid, burnConfirmed: false }, { ...valid, burnConfirmed: 'true' }, { ...valid, requestId: 'invalid' },
    { ...valid, textContent: ' \n ' }, { ...valid, textContent: '💛'.repeat(2001) }, { ...valid, type: 'VOICE' },
    { ...valid, destinationType: 'FRIEND' }, { ...valid, destinationType: 'INFINITY' }, { ...valid, senderId: 'victim' },
    { ...valid, authProviderId: 'bob' }, { ...valid, recipientId: 'bob' }, { ...valid, isSigned: true }, { ...valid, audioUrl: 'https://invalid.test' },
  ]) assert.equal((await send(input)).status, 400);
  assert.equal(calls, 0); assert.equal(letters.size, 0);
});
test('a burn stores only a deleted audit stub and returns an explicit content-free receipt', async () => {
  const input = { ...body(), textContent: '💛'.repeat(2000) };
  const response = await send(input); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const result = await response.json() as BurnReceipt; assert.equal(result.outcome, 'BURNED'); assert.equal(result.requestId, input.requestId);
  assert.ok(!JSON.stringify(result).includes('must-not-leak')); assert.ok(!JSON.stringify(result).includes('owner-alice'));
  assert.ok(!JSON.stringify(writes).includes(input.textContent));
  const row = [...letters.values()][0]!;
  assert.equal(row.senderId, 'owner-alice'); assert.equal(row.status, 'HARD_DELETED');
  for (const key of ['textContent', 'audioUrl', 'audioDurationMs', 'recipientId', 'posX', 'posY']) assert.equal(row[key], null);
  assert.equal(row.isSigned, false);
  assert.equal((await fetch(`${url}/letters/${result.receiptId}`, { headers: { Authorization: 'Bearer alice' } })).status, 404);
  assert.equal((await fetch(`${url}/letters`, { headers: { Authorization: 'Bearer alice' } })).status, 404);
});
test('retries and simultaneous duplicates return one stable outcome with one audit row', async () => {
  const input = body();
  const responses = await Promise.all(Array.from({ length: 6 }, () => send(input)));
  assert.ok(responses.every(r => r.status === 200));
  const results = await Promise.all(responses.map(r => r.json()));
  results.forEach(result => assert.deepEqual(result, results[0])); assert.equal(letters.size, 1); assert.equal(receipts.size, 1);
  assert.deepEqual(await (await send(input)).json(), results[0]);
});
test('receipts are scoped to the verified owner even when two accounts use the same request UUID', async () => {
  const input = body(); const first = await (await send(input)).json() as BurnReceipt;
  assert.deepEqual(await (await lookup(input.requestId, 'bob')).json(), { receipt: null });
  const second = await (await send(input, 'bob')).json() as BurnReceipt;
  assert.notEqual(first.receiptId, second.receiptId);
  assert.deepEqual(await (await lookup(input.requestId)).json(), { receipt: first });
  assert.deepEqual(await (await lookup(randomUUID())).json(), { receipt: null });
});
test('an unavailable preset produces a durable rejection that cannot become a late burn', async () => {
  active = false; const input = body(); const rejected = await (await send(input)).json() as BurnReceipt;
  assert.equal(rejected.outcome, 'REJECTED'); assert.equal(rejected.reason, 'PRESET_UNAVAILABLE'); assert.equal(letters.size, 0);
  active = true;
  assert.deepEqual(await (await send(input)).json(), rejected); assert.equal(letters.size, 0);
  assert.equal((await (await send({ ...input, requestId: randomUUID() })).json() as BurnReceipt).outcome, 'BURNED');
});
test('failure to save the receipt rolls back the audit write and never reports success', async () => {
  failReceipt = true; const input = body(); const response = await send(input);
  assert.equal(response.status, 503); assert.ok(!(await response.text()).includes('private database failure'));
  assert.equal(letters.size, 0); assert.equal(receipts.size, 0);
  failReceipt = false; assert.equal((await send(input)).status, 200); assert.equal(letters.size, 1);
});
test('a profile and companion are required, and request IDs are validated on receipt lookup', async () => {
  assert.equal((await send(body(), 'new-user')).status, 409); assert.equal((await send(body(), 'no-character')).status, 409);
  assert.equal((await lookup('invalid')).status, 400); assert.equal(letters.size, 0);
});
