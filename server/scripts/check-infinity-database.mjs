// Dedicated local/CI PostgreSQL only. No private .env, live identities,
// moderation, object store or push service is used.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url); const { PrismaClient } = require('@prisma/client');
const { InfinityService } = require('../dist/infinity/infinity.service.js'); const { VoiceAssetsService } = require('../dist/voice/voice-assets.service.js'); const { SafetyService } = require('../dist/safety/safety.service.js');
const url = process.env.INFINITY_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(new URL(url).hostname)) throw new Error('Set INFINITY_TEST_DATABASE_URL to an isolated local database. This script never loads server/.env.');
const prisma = new PrismaClient({ datasources: { db: { url } } }); const users = []; let held = null; let entered = () => {};
const world = new InfinityService(prisma, { available: true, voiceAvailable: false, check: async () => { entered(); if (held) await held; return 'APPROVED'; } }, new VoiceAssetsService(prisma, { available: false })); const safety = new SafetyService(prisma);
try {
  const character = await prisma.character.findFirst({ where: { isActive: true } }); const preset = await prisma.preset.findFirst({ where: { isActive: true } }); assert.ok(character && preset);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  for (let i = 0; i < 3; i++) users.push(await prisma.user.create({ data: { username: `sky_${suffix}_${i}`, authProviderId: `sky_fixture_${suffix}_${i}`, characterId: character.id } }));
  const [alice, bob, carol] = users;
  const body = { requestId: randomUUID(), type: 'TEXT', destinationType: 'INFINITY', presetId: preset.id, textContent: 'Synthetic public correspondence.', publicConfirmed: true, isSigned: false };
  const replies = await Promise.all(Array.from({ length: 4 }, () => world.send(alice.authProviderId, body))); replies.forEach(reply => assert.deepEqual(reply, replies[0])); assert.equal(await prisma.letter.count({ where: { senderId: alice.id } }), 1);
  const id = replies[0].letterId; assert.notEqual(id, replies[0].receiptId); const opened = await world.open(bob.authProviderId, id); assert.equal(opened.signature, null); assert.equal(opened.mine, false); assert.ok(!JSON.stringify(opened).includes(alice.id));
  const bounds = { minX: 0, maxX: 1600, minY: 0, maxY: 1000 }; assert.equal((await world.list(bob.authProviderId, bounds)).stars.length, 1); assert.deepEqual((await world.list(bob.authProviderId, null)).stars, []); assert.equal(await world.status(bob.authProviderId, body.requestId), null);
  await safety.report(bob.authProviderId, id, { reason: 'SPAM', blockSender: true, confirmed: true }); const closed = await safety.blocked(bob.authProviderId); assert.equal(closed.items[0].username, null); assert.ok(!JSON.stringify(closed).includes(alice.username));
  await assert.rejects(world.open(bob.authProviderId, id)); await safety.unblock(carol.authProviderId, closed.items[0].id); await assert.rejects(world.open(bob.authProviderId, id)); await safety.unblock(bob.authProviderId, closed.items[0].id); assert.equal((await world.open(bob.authProviderId, id)).signature, null);
  const signed = await world.send(alice.authProviderId, { ...body, requestId: randomUUID(), isSigned: true }); assert.equal((await world.open(carol.authProviderId, signed.letterId)).signature, alice.username);
  let release; const reached = new Promise(resolve => { entered = resolve; }); held = new Promise(resolve => { release = resolve; }); const pendingBody = { ...body, requestId: randomUUID() }; const pending = world.send(alice.authProviderId, pendingBody); await reached;
  const cancelled = await world.cancel(alice.authProviderId, pendingBody.requestId, false); release(); assert.deepEqual(await pending, cancelled); assert.equal(cancelled.reason, 'CANCELLED'); held = null;
  await assert.rejects(world.remove(bob.authProviderId, id)); await world.remove(alice.authProviderId, id); const row = await prisma.letter.findUniqueOrThrow({ where: { id } }); assert.equal(row.textContent, null); assert.equal(row.posX, null); assert.deepEqual(await world.send(alice.authProviderId, body), replies[0]);
  const deliveredData = { id: `star_${randomUUID()}`, senderId: alice.id, type: 'TEXT', destinationType: 'INFINITY', status: 'DELIVERED', presetId: preset.id, stationeryJson: {}, deliveredAt: new Date(), textContent: 'Synthetic constraint check', moderationPassed: true, moderationCheckedAt: new Date(), posX: 800, posY: 500 };
  await prisma.letter.create({ data: { ...deliveredData, id: 'star_' + randomUUID(), moderationPassed: null, moderationCheckedAt: null, moderationSkipped: true } });
  await assert.rejects(prisma.letter.create({ data: { ...deliveredData, id: 'star_' + randomUUID(), moderationSkipped: true } }));
  await assert.rejects(prisma.letter.create({ data: { ...deliveredData, posX: 1601 } })); await assert.rejects(prisma.letter.create({ data: { ...deliveredData, moderationPassed: false } })); await assert.rejects(prisma.letter.create({ data: { ...deliveredData, recipientId: bob.id } }));
  assert.equal(await prisma.friendNotification.count({ where: { userId: { in: users.map(user => user.id) } } }), 0);
  console.log('PostgreSQL Infinity checks passed: duplicate publication, anonymous/signed serialization, viewport/owner boundaries, anonymous report/block, cancel race, deletion/replay, integrity constraints and no public notifications.');
} finally {
  const ids = users.map(user => user.id);
  if (ids.length) {
    await prisma.report.deleteMany({ where: { reporterId: { in: ids } } }); await prisma.worldReceipt.deleteMany({ where: { ownerId: { in: ids } } }); await prisma.letter.deleteMany({ where: { senderId: { in: ids } } });
    await prisma.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } }); await prisma.friendRequest.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
}
