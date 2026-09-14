// Isolated local HTTP load rehearsal. Never reads .env or accepts a remote URL.
// Production moderation is untouched; the provider exists only in Nest's test module.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url); const root = fileURLToPath(new URL('..', import.meta.url));
const { createFriendsTestApp } = require('../server/dist-test/test/friends-fixture.js');
const context = await createFriendsTestApp(false, { available: true, voiceAvailable: false, check: async () => 'APPROVED' });
const owners = ['alice', 'bob', 'carol']; const samples = { reads: [], sends: [], replay: [] }; let largestPage = 0; let largestBytes = 0;
const summaries = values => { const sorted = [...values].sort((a, b) => a - b); return { requests: sorted.length, p50Ms: +sorted[Math.floor((sorted.length - 1) * .5)].toFixed(2), p95Ms: +sorted[Math.floor((sorted.length - 1) * .95)].toFixed(2), maxMs: +sorted.at(-1).toFixed(2) }; };
async function request(owner, path, body, bucket) {
  const start = performance.now(); const response = await fetch(context.url + path, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${owner}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
  const raw = await response.text(); samples[bucket]?.push(performance.now() - start); assert.equal(response.status, 200); return { body: JSON.parse(raw), bytes: Buffer.byteLength(raw) };
}
const input = () => ({ requestId: randomUUID(), type: 'TEXT', destinationType: 'INFINITY', presetId: 'preset_lantern', textContent: 'Synthetic load rehearsal.', publicConfirmed: true, isSigned: false });
try {
  const seed = await request('alice', '/letters', input(), 'sends'); assert.equal(seed.body.outcome, 'DELIVERED'); const template = context.fixture.state.letters[0];
  for (let i = 0; i < 5000; i++) context.fixture.state.letters.push({ ...template, id: `star_${randomUUID()}`, senderId: `owner-${owners[i % 3]}`, posX: (i * 37) % 1600, posY: (i * 71) % 1000, deliveredAt: new Date(1700000000000 + i) });
  const started = performance.now(); const operations = [];
  // Nine readers split over three identities, 90 requests each, below the real
  // 120/min viewport budget. Send workers keep distinct confirmed UUIDs.
  for (let worker = 0; worker < 9; worker++) operations.push((async () => {
    for (let i = 0; i < 30; i++) {
      const minX = (worker * 91 + i * 19) % 800; const minY = (i * 13) % 400;
      const result = await request(owners[worker % 3], `/infinity/stars?minX=${minX}&maxX=${minX + 800}&minY=${minY}&maxY=${minY + 600}`, undefined, 'reads');
      largestPage = Math.max(largestPage, result.body.stars.length); largestBytes = Math.max(largestBytes, result.bytes);
      assert.ok(result.body.stars.length <= 60); for (const star of result.body.stars) assert.deepEqual(Object.keys(star).sort(), ['id', 'type', 'x', 'y']);
    }
  })());
  for (const owner of owners) operations.push((async () => { for (let i = 0; i < 10; i++) { const body = input(); const receipt = await request(owner, '/letters', body, 'sends'); assert.equal(receipt.body.outcome, 'DELIVERED'); if (i < 5) assert.deepEqual((await request(owner, '/letters', body, 'replay')).body, receipt.body); } })());
  const results = await Promise.allSettled(operations); for (const result of results) if (result.status === 'rejected') throw result.reason;
  assert.equal(context.fixture.state.worldReceipts.length, 31); assert.equal(context.fixture.state.letters.length, 5031); assert.equal(context.fixture.state.jobs.length, 0);
  const report = { environment: 'Isolated localhost Nest HTTP with in-memory database and test moderation; not a production capacity estimate', datasetLetters: 5000, concurrentWorkers: 12, elapsedMs: Math.round(performance.now() - started), reads: summaries(samples.reads), sends: summaries(samples.sends), idempotentReplay: summaries(samples.replay), largestPage, largestResponseBytes: largestBytes, unexpectedFailures: 0, realDeliveries: 0 };
  await mkdir(resolve(root, '.cache/phase11-review'), { recursive: true }); await writeFile(resolve(root, '.cache/phase11-review/infinity-http-load.json'), JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
} finally { await context.app.close(); }
