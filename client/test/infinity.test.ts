import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { LetterPreset, WorldReceipt, WorldStar } from '@lantern-post/shared-types';
import { DraftController, decodeDraft } from '../src/letters/draft';
import { WorldController } from '../src/infinity/world-controller';
import type { WorldDeliveryTransport } from '../src/infinity/world-controller';
import { readWorldReceipt } from '../src/infinity/world-contract';
import { RealmCamera } from '../src/letters/realm-camera';
import { projectStar, starClusters, viewBounds } from '../src/infinity/world-map';
const id = '90000000-0000-4000-8000-000000000001'; const second = '90000000-0000-4000-8000-000000000002';
const preset: LetterPreset = { id: 'preset_lantern', key: 'royal', displayName: 'Royal ivory', description: 'An old page', config: { paperColor: '#F0DDB5', inkColor: '#493622', sealColor: '#874B36', ribbonColor: '#899069', texture: 'parchment', motif: 'royal', font: 'book' } };
const receipt = (signed = false, rejected = false): WorldReceipt => ({ requestId: id, receiptId: `world_${'c'.repeat(64)}`, isSigned: signed, outcome: rejected ? 'REJECTED' : 'DELIVERED', reason: rejected ? 'CANCELLED' : null, letterId: rejected ? null : `star_${second}`, completedAt: '2026-09-13T01:00:00Z' });
function fixture(voice = false) {
  let value: string | null = null; let fail = false; const storage = { read: () => value, write: (_key: string, next: string) => { if (fail) throw new Error('Full disk'); value = next; } };
  const draft = new DraftController('owner-a', storage); draft.openDesk(); draft.choosePreset(preset);
  if (voice) { draft.changeKind('VOICE'); draft.attachVoice({ id: second, mimeType: 'audio/webm', byteLength: 300, durationMs: 2400 }); } else draft.edit('A private little wish, not yet in the sky.');
  draft.seal(); return { draft, storage, fail: (next: boolean) => { fail = next; } };
}
const api = (override: Partial<WorldDeliveryTransport> = {}): WorldDeliveryTransport => ({ submit: async () => receipt(), lookup: async () => ({ receipt: null }), cancel: async () => receipt(false, true), capabilities: async () => ({ textAvailable: false, voiceAvailable: false }), ...override });
test('public signatures default off, and a failed pending save prevents any sharing request', async () => {
  const f = fixture(); let calls = 0; assert.equal(f.draft.getSnapshot().draft!.worldSigned, false);
  const courier = new WorldController(f.draft, api({ submit: async () => { calls++; return receipt(); } }), () => id);
  f.fail(true); await courier.confirm(); assert.equal(calls, 0); assert.equal(f.draft.getSnapshot().draft!.stage, 'sealed'); f.fail(false); f.draft.retrySave();
  await courier.confirm(); assert.equal(calls, 1); assert.equal(f.draft.getSnapshot().draft!.stage, 'published'); assert.equal(f.draft.getSnapshot().draft!.text, '');
});
test('pending public sharing fences editing, signature changes, other destinations and new drafts', () => {
  const f = fixture(); f.draft.chooseWorldSignature(true); f.draft.beginWorld(id);
  assert.equal(f.draft.chooseWorldSignature(false), false); assert.equal(f.draft.reset(), false); assert.equal(f.draft.beginBurn(second), false); assert.equal(f.draft.beginDelivery(second, { id: 'owner-b', username: 'bob', characterKey: 'fox-lantern', palaceName: 'A palace' }), false);
  f.draft.edit('replacement'); assert.equal(f.draft.getSnapshot().draft!.worldSigned, true); assert.equal(f.draft.pendingWorld()!.isSigned, true);
  assert.equal(f.draft.applyWorldReceipt(receipt(false)), false); assert.equal(f.draft.applyWorldReceipt({ ...receipt(true), requestId: second }), false); assert.equal(f.draft.applyWorldReceipt(receipt(true)), true);
});
test('lost public replies recover through an owner-scoped receipt without retransmitting content', async () => {
  const f = fixture(); let submissions = 0; const network = api({ submit: async () => { submissions++; throw new Error('Lost acknowledgement'); }, lookup: async () => ({ receipt: receipt() }) });
  await new WorldController(f.draft, network, () => id).confirm(); const reopened = new DraftController('owner-a', f.storage); reopened.openDesk(); assert.equal(reopened.getSnapshot().draft!.stage, 'world-pending');
  await new WorldController(reopened, network, () => second).check(); assert.equal(submissions, 1); assert.equal(reopened.getSnapshot().draft!.text, '');
  const fresh = new DraftController('owner-a', f.storage); fresh.openDesk(); assert.equal(fresh.getSnapshot().draft!.stage, 'writing'); assert.equal(fresh.getSnapshot().draft!.worldSigned, false);
});
test('cancellation keeps a voice take, while successful sharing queues deletion before a fresh page', async () => {
  const f = fixture(true); const courier = new WorldController(f.draft, api({ submit: async () => { throw new Error('Uncertain'); } }), () => id);
  await courier.confirm(); await courier.cancel(); assert.equal(f.draft.getSnapshot().draft!.stage, 'sealed'); assert.equal(f.draft.getSnapshot().draft!.voice!.id, second);
  f.draft.beginWorld(id); f.fail(true); assert.equal(f.draft.applyWorldReceipt(receipt()), false); assert.equal(f.draft.getSnapshot().draft!.voice, null); assert.deepEqual(f.draft.getSnapshot().draft!.voiceDeletes, [second]); assert.equal(f.draft.reset(), false);
  f.fail(false); f.draft.retrySave(); const fresh = new DraftController('owner-a', f.storage); fresh.openDesk(); assert.equal(fresh.getSnapshot().draft!.stage, 'published'); fresh.finishVoiceDelete(second); assert.equal(fresh.getSnapshot().draft!.stage, 'writing');
});
test('v4 voice drafts migrate intact and unknown or mismatched public receipts cannot clear them', () => {
  const f = fixture(true); const saved = f.draft.getSnapshot().draft!; const legacy = { ...saved, version: 4 }; const decoded = decodeDraft(JSON.stringify(legacy), 'owner-a'); assert.equal(decoded.version, 6); assert.equal(decoded.voice!.id, second); assert.equal(decoded.worldSigned, false); assert.equal(decoded.stage, 'sealed');
  assert.equal(readWorldReceipt({ ...receipt(), letterId: 'owner-a' }, id, false), null); assert.equal(readWorldReceipt({ ...receipt(), outcome: 'DELIVERED', reason: 'CANCELLED' }, id, false), null);
  assert.throws(() => decodeDraft(JSON.stringify({ ...saved, stage: 'published', worldRequestId: id, worldReceipt: receipt(true) }), 'owner-a'));
});
test('sky view bounds and star projection agree after zoom, pinch and pan, with bounded clustering', () => {
  const camera = new RealmCamera(); camera.resize(390, 470); camera.focus({ x: 1100, y: 500 }, 2.5); const view = camera.getSnapshot(); const bounds = viewBounds(view);
  assert.ok(bounds.minX >= 0 && bounds.maxX <= 1600 && bounds.minY >= 0 && bounds.maxY <= 1000); assert.ok(bounds.minX < 1100 && bounds.maxX > 1100);
  const star: WorldStar = { id: 'one', type: 'TEXT', x: 1100, y: 500 }; const point = projectStar(star, view); assert.ok(Math.abs(point.x - view.width / 2) < 1); assert.ok(Math.abs(point.y - view.height / 2) < 1);
  const many = Array.from({ length: 180 }, (_, i) => ({ ...star, id: 'star-' + i, x: 1100 + i % 5, y: 500 + i % 5 })); const groups = starClusters([...many, star, star, { ...star, id: 'outside', x: 0 }], view); assert.ok(groups.length <= 4); assert.equal(groups.flatMap(group => group.stars).length, 181);
});
