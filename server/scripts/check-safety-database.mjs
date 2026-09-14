// Run after build:api on an explicitly isolated local/CI database. Never loads
// server/.env or contacts moderation, storage, notifications or real identities.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { PrismaClient } = require('@prisma/client');
const { SafetyService } = require('../dist/safety/safety.service.js'); const { RequestLimits } = require('../dist/safety/request-limits.js'); const { FriendLettersService } = require('../dist/letters/friend-letters.service.js'); const { VoiceAssetsService } = require('../dist/voice/voice-assets.service.js');
const url = process.env.SAFETY_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(new URL(url).hostname)) throw new Error('Set SAFETY_TEST_DATABASE_URL to an isolated local PostgreSQL database. This script never loads server/.env.');
const prisma = new PrismaClient({ datasources: { db: { url } } }); const users = []; const budgetIds = [];
const safety = new SafetyService(prisma); let hold = null; let entered = () => {};
const letters = new FriendLettersService(prisma, { check: async () => { entered(); if (hold) await hold; return 'APPROVED'; } }, new VoiceAssetsService(prisma, { available: false }));
try {
  const character = await prisma.character.findFirst({ where: { isActive: true } }); const preset = await prisma.preset.findFirst({ where: { isActive: true } }); assert.ok(character && preset);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  for (let i = 0; i < 3; i++) users.push(await prisma.user.create({ data: { username: `safe_${suffix}_${i}`, authProviderId: `safety_fixture_${suffix}_${i}`, characterId: character.id } }));
  const [alice, bob, carol] = users; const friendship = await prisma.friendRequest.create({ data: { fromUserId: alice.id, toUserId: bob.id, status: 'ACCEPTED', respondedAt: new Date() } });
  const input = { requestId: randomUUID(), type: 'TEXT', destinationType: 'FRIEND', recipientId: bob.id, presetId: preset.id, textContent: 'Synthetic safety-test correspondence.', deliveryConfirmed: true };
  const delivered = await letters.send(alice.authProviderId, input); assert.equal(delivered.outcome, 'DELIVERED');
  const report = { reason: 'SPAM', blockSender: false, confirmed: true }; const results = await Promise.all([safety.report(bob.authProviderId, delivered.letterId, report), safety.report(bob.authProviderId, delivered.letterId, report)]); assert.equal(results[0].id, results[1].id);
  assert.equal(await prisma.report.count({ where: { reporterId: bob.id } }), 1); await assert.rejects(safety.report(carol.authProviderId, delivered.letterId, report));
  let release; const reached = new Promise(resolve => { entered = resolve; }); hold = new Promise(resolve => { release = resolve; });
  const pending = letters.send(alice.authProviderId, { ...input, requestId: randomUUID() }); await reached;
  await Promise.all([safety.block(bob.authProviderId, alice.id), safety.block(bob.authProviderId, alice.id)]); release(); assert.equal((await pending).reason, 'FRIEND_UNAVAILABLE'); hold = null;
  assert.equal(await prisma.block.count({ where: { blockerId: bob.id } }), 1); await assert.rejects(letters.open(bob.authProviderId, delivered.letterId));
  await safety.unblock(carol.authProviderId, alice.id); assert.equal(await prisma.block.count({ where: { blockerId: bob.id } }), 1);
  await safety.unblock(bob.authProviderId, alice.id); assert.equal((await prisma.friendRequest.findUniqueOrThrow({ where: { id: friendship.id } })).status, 'DECLINED'); await assert.rejects(letters.open(bob.authProviderId, delivered.letterId));
  await assert.rejects(prisma.block.create({ data: { blockerId: alice.id, blockedId: alice.id } }));
  const scope = 'ci-' + suffix; const budget = { scope, maximum: 2, milliseconds: 60000 }; const now = Date.now();
  const { createHash } = await import('node:crypto'); budgetIds.push(createHash('sha256').update(`${alice.authProviderId}\0${scope}\0${Math.floor(now / 60000)}`).digest('hex'));
  const first = new RequestLimits(prisma); const second = new RequestLimits(prisma); const attempts = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => (index % 2 ? first : second).consume(alice.authProviderId, budget, now)));
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 2); assert.equal((await prisma.requestWindow.findUniqueOrThrow({ where: { id: budgetIds[0] } })).count, 2);
  console.log('PostgreSQL safety checks passed: report deduplication, concurrent blocks, block/delivery race, owner isolation, no automatic friendship restore, constraints and shared request limits.');
} finally {
  const ids = users.map(user => user.id);
  if (budgetIds.length) await prisma.requestWindow.deleteMany({ where: { id: { in: budgetIds } } });
  if (ids.length) {
    await prisma.report.deleteMany({ where: { reporterId: { in: ids } } }); await prisma.friendNotification.deleteMany({ where: { userId: { in: ids } } }); await prisma.deliveryReceipt.deleteMany({ where: { ownerId: { in: ids } } }); await prisma.letter.deleteMany({ where: { senderId: { in: ids } } });
    await prisma.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } }); await prisma.friendRequest.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
}
