// Real PostgreSQL tests only on a dedicated local/CI database. No live
// identity, moderation service, notification, or server/.env is used.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { FriendLettersService } = require('../dist/letters/friend-letters.service.js');
const { VoiceAssetsService } = require('../dist/voice/voice-assets.service.js');
const url = process.env.PRIVATE_LETTERS_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(new URL(url).hostname)) throw new Error('Set PRIVATE_LETTERS_TEST_DATABASE_URL to an isolated local PostgreSQL database. This script never loads server/.env.');
const prisma = new PrismaClient({ datasources: { db: { url } } });
const users = []; let moderation = 'APPROVED'; let held = null; let reached = () => {};
const service = new FriendLettersService(prisma, { available: true, check: async () => { reached(); if (held) await held; return moderation; } }, new VoiceAssetsService(prisma, { available: false }));
try {
  const character = await prisma.character.findFirst({ where: { isActive: true } }); const preset = await prisma.preset.findFirst({ where: { isActive: true } }); assert.ok(character && preset);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  for (let i = 0; i < 3; i++) users.push(await prisma.user.create({ data: { username: `letter_${suffix}_${i}`, authProviderId: `user_letter_fixture_${suffix}_${i}`, characterId: character.id } }));
  const [alice, bob, outsider] = users;
  await prisma.friendRequest.create({ data: { fromUserId: alice.id, toUserId: bob.id, status: 'ACCEPTED', respondedAt: new Date() } });
  const body = { requestId: randomUUID(), type: 'TEXT', destinationType: 'FRIEND', textContent: 'Synthetic private integration letter.', presetId: preset.id, recipientId: bob.id, deliveryConfirmed: true };
  const results = await Promise.all(Array.from({ length: 6 }, () => service.send(alice.authProviderId, body)));
  results.forEach(result => assert.deepEqual(result, results[0])); assert.equal(results[0].outcome, 'DELIVERED');
  assert.equal(await prisma.letter.count({ where: { senderId: alice.id } }), 1); assert.equal(await prisma.friendNotification.count({ where: { letterId: results[0].letterId } }), 1);
  assert.equal(await service.status(bob.authProviderId, body.requestId), null);
  await assert.rejects(service.open(outsider.authProviderId, results[0].letterId));
  assert.equal((await service.open(bob.authProviderId, results[0].letterId)).textContent, body.textContent);
  assert.deepEqual(await service.summary(bob.authProviderId), { unread: 0, received: 1, sent: 0 });
  moderation = 'REJECTED'; const rejectedBody = { ...body, requestId: randomUUID(), textContent: 'Synthetic rejected text: do not retain.' }; const rejection = await service.send(alice.authProviderId, rejectedBody);
  assert.equal(rejection.reason, 'CONTENT_NOT_ALLOWED'); assert.equal(await prisma.letter.count({ where: { senderId: alice.id } }), 1);
  moderation = 'APPROVED'; assert.deepEqual(await service.send(alice.authProviderId, rejectedBody), rejection);
  const entered = new Promise(resolve => { reached = resolve; }); let release = () => {}; held = new Promise(resolve => { release = resolve; });
  const cancelBody = { ...body, requestId: randomUUID() }; const sending = service.send(alice.authProviderId, cancelBody); await entered;
  const cancelled = await service.cancel(alice.authProviderId, cancelBody.requestId, bob.id); release(); assert.deepEqual(await sending, cancelled); assert.equal(cancelled.reason, 'CANCELLED'); held = null;
  await assert.rejects(prisma.deliveryReceipt.create({ data: { id: `invalid_${suffix}`, ownerId: alice.id, recipientId: bob.id, outcome: 'REJECTED', reason: null } }));
  await assert.rejects(prisma.letter.create({ data: { senderId: alice.id, recipientId: bob.id, type: 'TEXT', destinationType: 'FRIEND', status: 'DELIVERED', textContent: 'Synthetic unapproved content', moderationPassed: false } }));
  const savedLetter = await prisma.letter.findUniqueOrThrow({ where: { id: results[0].letterId } });
  const unreviewed = await prisma.letter.create({ data: { ...savedLetter, id: 'unreviewed_' + randomUUID(), moderationPassed: null, moderationCheckedAt: null, moderationSkipped: true } });
  assert.equal((await service.open(bob.authProviderId, unreviewed.id)).textContent, body.textContent);
  await assert.rejects(prisma.letter.create({ data: { ...savedLetter, id: 'invalid_' + randomUUID(), moderationSkipped: true } }));
  await service.remove(bob.authProviderId, results[0].letterId); assert.equal((await service.open(alice.authProviderId,results[0].letterId)).textContent,body.textContent); await service.remove(alice.authProviderId,results[0].letterId); const deleted = await prisma.letter.findUniqueOrThrow({ where: { id: results[0].letterId } });
  assert.equal(deleted.textContent, null); assert.equal(deleted.stationeryJson, null); assert.deepEqual(await service.send(alice.authProviderId, body), results[0]);
  const newer = await service.send(alice.authProviderId, { ...body, requestId: randomUUID() });
  await prisma.block.create({ data: { blockerId: bob.id, blockedId: alice.id } });
  await assert.rejects(service.open(bob.authProviderId, newer.letterId)); assert.deepEqual((await service.list(bob.authProviderId, 'received')).letters, []);
  console.log('PostgreSQL private-letter checks passed: duplicates, atomic outbox, owner isolation, moderation constraints, cancel race, reading, deletion and blocking.');
} finally {
  const ids = users.map(user => user.id);
  if (ids.length) {
    await prisma.friendNotification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.deliveryReceipt.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.letter.deleteMany({ where: { senderId: { in: ids } } });
    await prisma.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
    await prisma.friendRequest.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
}
