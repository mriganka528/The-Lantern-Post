// Real PostgreSQL with isolated synthetic storage/moderation providers.
// Run after npm test and build:api; never loads server/.env or live services.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { VoiceAssetsService } = require('../dist/voice/voice-assets.service.js');
const { FriendLettersService } = require('../dist/letters/friend-letters.service.js');
const { memoryVoiceStorage, syntheticWebm } = require('../dist-test/test/voice-fixture.js');
const url = process.env.VOICE_TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(new URL(url).hostname)) throw new Error('Set VOICE_TEST_DATABASE_URL to an isolated local PostgreSQL database. This script never loads server/.env.');
const prisma = new PrismaClient({ datasources: { db: { url } } }); const media = memoryVoiceStorage(); const voice = new VoiceAssetsService(prisma, media.storage);
let hold = null; let entered = () => {}; const users = [];
const service = new FriendLettersService(prisma, { available: true, voiceAvailable: true, checkVoice: async () => { entered(); if (hold) await hold; return 'APPROVED'; } }, voice);
try {
  const character = await prisma.character.findFirst({ where: { isActive: true } }); const preset = await prisma.preset.findFirst({ where: { isActive: true } }); assert.ok(character && preset);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  for (let i = 0; i < 3; i++) users.push(await prisma.user.create({ data: { username: `voice_${suffix}_${i}`, authProviderId: `voice_fixture_${suffix}_${i}`, characterId: character.id } }));
  const [alice, bob, outsider] = users; await prisma.friendRequest.create({ data: { fromUserId: alice.id, toUserId: bob.id, status: 'ACCEPTED', respondedAt: new Date() } });
  async function prepare() {
    const bytes = syntheticWebm(); const input = { requestId: randomUUID(), recipientId: bob.id, mimeType: 'audio/webm', byteLength: bytes.length, durationMs: 2000, sha256: createHash('sha256').update(bytes).digest('base64') };
    const grant = await voice.create(alice.authProviderId, input); media.objects.set(`voice/incoming/${grant.assetId}`, bytes);
    await Promise.all([voice.finish(alice.authProviderId, grant.assetId), voice.finish(alice.authProviderId, grant.assetId)]);
    return { requestId: input.requestId, type: 'VOICE', destinationType: 'FRIEND', presetId: preset.id, recipientId: bob.id, voiceAssetId: grant.assetId, deliveryConfirmed: true };
  }
  const input = await prepare(); const results = await Promise.all(Array.from({ length: 4 }, () => service.send(alice.authProviderId, input)));
  results.forEach(result => assert.deepEqual(result, results[0])); assert.equal(results[0].outcome, 'DELIVERED');
  assert.equal(await prisma.letter.count({ where: { senderId: alice.id } }), 1); assert.equal(await prisma.friendNotification.count({ where: { letterId: results[0].letterId } }), 1);
  assert.equal((await prisma.voiceAsset.findUniqueOrThrow({ where: { id: input.voiceAssetId } })).status, 'ATTACHED');
  await assert.rejects(service.open(outsider.authProviderId, results[0].letterId)); assert.equal((await service.open(bob.authProviderId, results[0].letterId)).audio.durationMs, 2000);
  const cancelInput = await prepare(); let release; const reached = new Promise(resolve => { entered = resolve; }); hold = new Promise(resolve => { release = resolve; });
  const sending = service.send(alice.authProviderId, cancelInput); await reached; const cancelled = await service.cancel(alice.authProviderId, cancelInput.requestId, bob.id); release();
  assert.equal(cancelled.reason, 'CANCELLED'); assert.deepEqual(await sending, cancelled); hold = null;
  await voice.cleanup(); assert.equal(media.objects.has(`voice/sealed/${cancelInput.voiceAssetId}`), false);
  // Constraint failures must reject null duration and raw audio URLs, even with approval.
  const third = await prepare();
  for (const invalid of [{ audioDurationMs: null }, { audioDurationMs: 2000, audioUrl: 'https://untrusted.example/audio' }]) {
    await assert.rejects(prisma.letter.create({ data: { senderId: alice.id, recipientId: bob.id, type: 'VOICE', destinationType: 'FRIEND', status: 'DELIVERED', voiceAssetId: third.voiceAssetId, deliveredAt: new Date(), moderationPassed: true, moderationCheckedAt: new Date(), stationeryJson: {}, ...invalid } }));
  }
  await service.remove(bob.authProviderId, results[0].letterId); await voice.cleanup();assert.equal(media.objects.has(`voice/sealed/${input.voiceAssetId}`),true);await service.remove(alice.authProviderId,results[0].letterId);await voice.cleanup(); assert.equal(media.objects.has(`voice/sealed/${input.voiceAssetId}`), false); assert.deepEqual(await service.send(alice.authProviderId, input), results[0]);
  await prisma.voiceAsset.update({ where: { id: third.voiceAssetId }, data: { expiresAt: new Date(Date.now() - 1000) } }); await voice.cleanup();
  assert.equal(media.objects.has(`voice/incoming/${third.voiceAssetId}`), false); assert.equal(media.objects.has(`voice/sealed/${third.voiceAssetId}`), false);
  console.log('PostgreSQL voice checks passed: concurrent promotion/delivery, atomic receipt/outbox, privacy, cancel race, constraints, deletion and expiry.');
} finally {
  const ids = users.map(user => user.id);
  if (ids.length) {
    await prisma.friendNotification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.deliveryReceipt.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.letter.deleteMany({ where: { senderId: { in: ids } } });
    await prisma.voiceAsset.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.friendRequest.deleteMany({ where: { OR: [{ fromUserId: { in: ids } }, { toUserId: { in: ids } }] } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.$disconnect();
}
