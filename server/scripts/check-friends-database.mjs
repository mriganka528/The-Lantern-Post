// Dedicated local/CI PostgreSQL only. No live identities or push delivery.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { FriendsService } = require('../dist/friends/friends.service.js');
const url = process.env.FRIENDS_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(new URL(url).hostname)) throw new Error('Set FRIENDS_TEST_DATABASE_URL to a dedicated local PostgreSQL database. This check never loads server/.env.');
const prisma = new PrismaClient({ datasources: { db: { url } } });
const service = new FriendsService(prisma); const users = []; let lookalikeId;
try {
  const character = await prisma.character.findFirst({ where: { isActive: true } }); assert.ok(character, 'Apply catalog migrations first.');
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  for (let i = 0; i < 2; i++) users.push(await prisma.user.create({ data: { username: `friend_${suffix}_${i}`, authProviderId: `user_friend_fixture_${suffix}_${i}`, characterId: character.id } }));
  const [alice, bob] = users;
  const lookalike = await prisma.user.create({ data: { username: bob.username.replaceAll('_', 'x'), authProviderId: `user_friend_lookalike_${suffix}`, characterId: character.id } });
  lookalikeId = lookalike.id;
  assert.deepEqual((await service.search(alice.authProviderId, bob.username)).results.map(r => r.person.id), [bob.id], 'Underscores must be literal username characters, not LIKE wildcards.');
  const attempts = await Promise.all(Array.from({ length: 6 }, (_, i) => i % 2 ? service.send(bob.authProviderId, alice.username) : service.send(alice.authProviderId, bob.username)));
  assert.equal(new Set(attempts.map(r => r.id)).size, 1); assert.ok(attempts.every(r => r.status === 'PENDING'));
  const row = await prisma.friendRequest.findUniqueOrThrow({ where: { id: attempts[0].id } });
  assert.equal(await prisma.friendNotification.count({ where: { requestId: row.id } }), 1);
  await assert.rejects(prisma.friendRequest.create({ data: { fromUserId: row.toUserId, toUserId: row.fromUserId } }));
  await assert.rejects(prisma.friendRequest.create({ data: { fromUserId: alice.id, toUserId: alice.id } }));
  const recipient = users.find(u => u.id === row.toUserId);
  const replies = await Promise.all(Array.from({ length: 6 }, () => service.respond(recipient.authProviderId, row.id, 'accept')));
  assert.ok(replies.every(r => r.status === 'ACCEPTED')); assert.equal(await prisma.friendNotification.count({ where: { requestId: row.id } }), 2);
  for (const who of users) assert.equal((await service.list(who.authProviderId, 'friends')).items.length, 1);
  await prisma.block.create({ data: { blockerId: bob.id, blockedId: alice.id } });
  for (const who of users) assert.equal((await service.list(who.authProviderId, 'friends')).items.length, 0);
  assert.equal((await service.search(alice.authProviderId, bob.username)).results.length, 0);
  console.log('PostgreSQL friendship checks passed: reverse-request races, pair/self constraints, repeated acceptance, atomic outbox, mutual lists, and blocking.');
} finally {
  const ids = [...users.map(u => u.id), ...(lookalikeId ? [lookalikeId] : [])];
  if (ids.length) {
    await prisma.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } });
    await prisma.friendRequest.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
}
