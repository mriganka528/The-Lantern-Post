// Opt-in PostgreSQL load rehearsal, on an explicitly named local test/CI DB.
// No private .env is loaded. Only rows owned by this run's random users are removed.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
const raw = process.env.INFINITY_LOAD_DATABASE_URL; const url = raw ? new URL(raw) : null;
if (!url || !['localhost', '127.0.0.1', '::1', '[::1]', 'postgres'].includes(url.hostname) || !/_(test|ci)$/.test(url.pathname)) throw new Error('Set INFINITY_LOAD_DATABASE_URL to a dedicated local database whose name ends in _test or _ci. No server/.env is loaded.');
const require = createRequire(import.meta.url); const { PrismaClient } = require('@prisma/client'); const { InfinityService } = require('../dist/infinity/infinity.service.js'); const { VoiceAssetsService } = require('../dist/voice/voice-assets.service.js');
const prisma = new PrismaClient({ datasources: { db: { url: raw } } }); const users = []; const timings = { read: [], send: [] };
const world = new InfinityService(prisma, { available: true, voiceAvailable: false, check: async () => 'APPROVED' }, new VoiceAssetsService(prisma, { available: false }));
const p95 = values => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * .95)];
try {
  const character = await prisma.character.findFirst({ where: { isActive: true } }); const preset = await prisma.preset.findFirst({ where: { isActive: true } }); assert.ok(character && preset);
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  for (let i = 0; i < 10; i++) users.push(await prisma.user.create({ data: { username: `load_${suffix}_${i}`, authProviderId: `load_fixture_${suffix}_${i}`, characterId: character.id } }));
  for (let batch = 0; batch < 10; batch++) await prisma.letter.createMany({ data: Array.from({ length: 1000 }, (_, n) => ({ id: `star_${randomUUID()}`, senderId: users[(batch + n) % 10].id, type: 'TEXT', destinationType: 'INFINITY', status: 'DELIVERED', presetId: preset.id, stationeryJson: {}, deliveredAt: new Date(1700000000000 + batch * 1000 + n), textContent: 'Synthetic load fixture', moderationPassed: true, moderationCheckedAt: new Date(), isSigned: false, posX: (n * 37 + batch) % 1600, posY: (n * 71 + batch) % 1000 })) });
  const work = users.map(async (user, i) => {
    for (let n = 0; n < 20; n++) {
      let started = performance.now(); const page = await world.list(user.authProviderId, { minX: i * 40, maxX: i * 40 + 800, minY: n * 10, maxY: n * 10 + 600 }); timings.read.push(performance.now() - started);
      assert.ok(page.stars.length <= 60); assert.ok(page.stars.every(star => Object.keys(star).sort().join(',') === 'id,type,x,y'));
      if (n < 10) { started = performance.now(); const request = { requestId: randomUUID(), type: 'TEXT', destinationType: 'INFINITY', textContent: 'Synthetic confirmed load letter.', presetId: preset.id, isSigned: false, publicConfirmed: true }; const result = await world.send(user.authProviderId, request); timings.send.push(performance.now() - started); assert.equal(result.outcome, 'DELIVERED'); if (n === 0) assert.deepEqual(await world.send(user.authProviderId, request), result); }
    }
  });
  const results = await Promise.allSettled(work); for (const result of results) if (result.status === 'rejected') throw result.reason;
  assert.equal(await prisma.worldReceipt.count({ where: { ownerId: { in: users.map(user => user.id) } } }), 100);
  const report = { environment: 'Dedicated local PostgreSQL service load, isolated test moderation; excludes network/provider latency', datasetLetters: 10000, concurrentWorkers: 10, reads: timings.read.length, sends: timings.send.length, readP95Ms: Math.round(p95(timings.read)), sendP95Ms: Math.round(p95(timings.send)), unexpectedFailures: 0 };
  const directory = new URL('../../.cache/phase11-review/', import.meta.url); await mkdir(directory, { recursive: true }); await writeFile(new URL('infinity-postgres-load.json', directory), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} finally {
  const ids = users.map(user => user.id);
  if (ids.length) { await prisma.worldReceipt.deleteMany({ where: { ownerId: { in: ids } } }); await prisma.letter.deleteMany({ where: { senderId: { in: ids } } }); await prisma.user.deleteMany({ where: { id: { in: ids } } }); }
  await prisma.$disconnect();
}
