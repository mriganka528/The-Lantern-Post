// Real PostgreSQL transaction checks for a dedicated local/CI test database.
// This deliberately does not load server/.env or use the app's Neon connection.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { LettersService } = require('../dist/letters/letters.service.js');
const url = process.env.BURN_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(new URL(url).hostname)) {
  throw new Error('Set BURN_TEST_DATABASE_URL to a dedicated local PostgreSQL test database. This check never uses server/.env.');
}
const prisma = new PrismaClient({ datasources: { db: { url } } });
const service = new LettersService(prisma);
const createdOwners = [];
let extraPresetId;
try {
  const character = await prisma.character.findFirst({ where: { isActive: true } });
  const preset = await prisma.preset.findFirst({ where: { isActive: true } });
  assert.ok(character && preset, 'Apply the catalog migrations to the test database first.');
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  for (let i = 0; i < 2; i++) {
    const user = await prisma.user.create({ data: { username: `burn_${suffix}_${i}`, authProviderId: `user_burn_fixture_${suffix}_${i}`, characterId: character.id } });
    createdOwners.push(user);
  }
  const [alice, bob] = createdOwners;
  const input = { requestId: randomUUID(), type: 'TEXT', destinationType: 'BURNING', presetId: preset.id, burnConfirmed: true, textContent: 'Synthetic integration-test content. Never persist this sentence.' };
  const responses = await Promise.all(Array.from({ length: 8 }, () => service.burn(alice.authProviderId, input)));
  responses.forEach(response => assert.deepEqual(response, responses[0]));
  assert.equal(responses[0].outcome, 'BURNED');
  const rows = await prisma.letter.findMany({ where: { senderId: alice.id } });
  assert.equal(rows.length, 1); assert.equal(rows[0].status, 'HARD_DELETED');
  assert.equal(rows[0].textContent, null); assert.equal(rows[0].audioUrl, null); assert.equal(rows[0].recipientId, null);
  assert.equal(await service.receipt(bob.authProviderId, input.requestId), null);
  const bobReceipt = await service.burn(bob.authProviderId, input);
  assert.notEqual(bobReceipt.receiptId, responses[0].receiptId);
  const extra = await prisma.preset.create({ data: { key: `burn-fixture-${suffix}`, displayName: 'Synthetic test stationery', configJson: preset.configJson, isActive: false } });
  extraPresetId = extra.id;
  const rejectedInput = { ...input, requestId: randomUUID(), presetId: extra.id };
  const rejected = await service.burn(alice.authProviderId, rejectedInput);
  assert.equal(rejected.outcome, 'REJECTED');
  await prisma.preset.update({ where: { id: extra.id }, data: { isActive: true } });
  assert.deepEqual(await service.burn(alice.authProviderId, rejectedInput), rejected);
  await prisma.preset.update({ where: { id: extra.id }, data: { isActive: false } });
  const racingId = randomUUID();
  const race = await Promise.all([
    service.burn(alice.authProviderId, { ...input, requestId: racingId, presetId: extra.id }),
    service.burn(alice.authProviderId, { ...input, requestId: racingId }),
  ]);
  assert.deepEqual(race[0], race[1]);
  const raceCount = await prisma.letter.count({ where: { id: race[0].receiptId } });
  assert.equal(raceCount, race[0].outcome === 'BURNED' ? 1 : 0, 'The losing transaction must roll back its audit row');
  await assert.rejects(prisma.burnReceipt.create({ data: { id: `invalid-${suffix}`, ownerId: alice.id, outcome: 'BURNED', reason: null, letterId: null } }));
  await assert.rejects(prisma.burnReceipt.create({ data: { id: `invalid-rejection-${suffix}`, ownerId: alice.id, outcome: 'REJECTED', reason: null, letterId: null } }));
  console.log('PostgreSQL burn checks passed: duplicates, owner isolation, durable rejection, racing outcomes, and database constraints.');
} finally {
  if (createdOwners.length) {
    const ids = createdOwners.map(owner => owner.id);
    await prisma.burnReceipt.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.letter.deleteMany({ where: { senderId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  if (extraPresetId) await prisma.preset.delete({ where: { id: extraPresetId } });
  await prisma.$disconnect();
}
