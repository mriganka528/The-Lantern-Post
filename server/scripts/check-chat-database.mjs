// Dedicated local/CI PostgreSQL only; never loads .env or calls live providers.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const raw = process.env.CHAT_TEST_DATABASE_URL; const url = raw ? new URL(raw) : null;
if (!url || !['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(url.hostname) || !/_(test|ci)$/.test(url.pathname)) throw Error('Set CHAT_TEST_DATABASE_URL to a dedicated local database ending in _test or _ci. No server/.env is loaded.');
const require = createRequire(import.meta.url); const { PrismaClient } = require('@prisma/client'); const { ChatService } = require('../dist/chat/chat.service.js'); const { ChatSignal } = require('../dist/chat/chat-signal.js'); const { SafetyService } = require('../dist/safety/safety.service.js');
const prisma = new PrismaClient({ datasources: { db: { url: raw } } }); const users = []; const safety = new SafetyService(prisma);
const provider = { available: true, check: async () => 'APPROVED' };
const first = new ChatService(prisma, provider, safety, new ChatSignal()); const second = new ChatService(prisma, provider, safety, new ChatSignal());
try {
  const character = await prisma.character.findFirst({ where: { isActive: true } }); assert.ok(character);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  for (let i = 0; i < 3; i++) users.push(await prisma.user.create({ data: { username: `chat_${suffix}_${i}`, authProviderId: `chat_fixture_${suffix}_${i}`, characterId: character.id } }));
  const [alice, bob, carol] = users; await prisma.friendRequest.create({ data: { fromUserId: alice.id, toUserId: bob.id, status: 'ACCEPTED', respondedAt: new Date() } });
  const input = () => ({ requestId: randomUUID(), text: 'Synthetic private parlour message.', confirmed: true });
  const waiting = first.poll(bob.authProviderId, alice.id, 0, undefined, 3000);
  const body = input(); const sent = await second.send(alice.authProviderId, bob.id, body); assert.equal(sent.outcome, 'DELIVERED'); assert.equal((await waiting).messages[0].id, sent.messageId);
  assert.deepEqual(await first.send(alice.authProviderId, bob.id, body), sent); assert.equal(await first.status(carol.authProviderId, bob.id, body.requestId), null);
  for (let batch = 0; batch < 4; batch++) {
    const results = await Promise.allSettled([first.send(alice.authProviderId, bob.id, input()), second.send(bob.authProviderId, alice.id, input()), second.send(alice.authProviderId, bob.id, input()), first.send(bob.authProviderId, alice.id, input())]);
    for (const result of results) { if (result.status === 'rejected') throw result.reason; assert.equal(result.value.outcome, 'DELIVERED'); }
  }
  const messages = await prisma.chatMessage.findMany({ where: { senderId: { in: users.map(user => user.id) } }, orderBy: { sequence: 'asc' } }); assert.equal(messages.length, 17); assert.deepEqual(messages.map(m => m.sequence), Array.from({ length: 17 }, (_, i) => i + 1));
  await assert.rejects(first.history(carol.authProviderId, bob.id));
  await assert.rejects(prisma.chatMessage.create({ data: { id: 'chatmsg_' + randomUUID(), threadId: messages[0].threadId, senderId: alice.id, sequence: 999, text: 'Must not be stored.', moderationPassed: false } }));
  const unreviewed = { id: 'chatmsg_' + randomUUID(), threadId: messages[0].threadId, senderId: alice.id, sequence: 999, text: 'Synthetic unreviewed chat.', moderationPassed: null, moderationSkipped: true };
  await prisma.chatMessage.create({ data: unreviewed });
  await assert.rejects(prisma.chatMessage.create({ data: { ...unreviewed, id: 'chatmsg_' + randomUUID(), sequence: 1000, moderationPassed: true } }));
  await assert.rejects(prisma.chatMessage.create({ data: { ...unreviewed, id: 'chatmsg_' + randomUUID(), sequence: 1000, moderationSkipped: false } }));
  await assert.rejects(prisma.chatReceipt.create({ data: { id: 'chat_' + randomUUID(), ownerId: alice.id, peerId: bob.id, outcome: 'DELIVERED', messageId: 'chatmsg_' + randomUUID(), sequence: null } }));
  const report = { reason: 'SPAM', confirmed: true, blockSender: true }; const saved = await first.report(bob.authProviderId, sent.messageId, report); assert.deepEqual(await second.report(bob.authProviderId, sent.messageId, report), saved);
  await assert.rejects(first.history(alice.authProviderId, bob.id)); await safety.unblock(bob.authProviderId, alice.id); await assert.rejects(first.history(alice.authProviderId, bob.id));
  assert.deepEqual(await first.status(alice.authProviderId, bob.id, body.requestId), sent);
  console.log('PostgreSQL chat checks passed: cross-instance live reads, committed sequence ordering, idempotent receipts, authorization, moderation constraints, deduplicated report/block and no automatic friendship restoration.');
} finally {
  const ids = users.map(user => user.id);
  if (ids.length) {
    await prisma.chatReport.deleteMany({ where: { reporterId: { in: ids } } }); await prisma.chatReceipt.deleteMany({ where: { ownerId: { in: ids } } }); await prisma.chatMessage.deleteMany({ where: { senderId: { in: ids } } });
    await prisma.chatThread.deleteMany({ where: { OR: [{ firstUserId: { in: ids } }, { secondUserId: { in: ids } }] } });
    await prisma.block.deleteMany({ where: { OR: [{ blockerId: { in: ids } }, { blockedId: { in: ids } }] } }); await prisma.friendRequest.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } }); await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
}
