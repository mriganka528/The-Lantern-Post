import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DeliveryReceipt, LetterPreset, LetterRecipient } from '@lantern-post/shared-types';
import { DeliveryController } from '../src/letters/delivery-controller';
import type { DeliveryTransport } from '../src/letters/delivery-controller';
import { decodeDraft, DraftController, newDraft } from '../src/letters/draft';
import type { DraftStorage } from '../src/letters/draft';
import { cleanRecipient, readDeliveryReceipt } from '../src/letters/delivery-contract';
import { notificationDestination } from '../src/notifications/notification-contract';

const firstId = '40000000-0000-4000-8000-000000000001'; const secondId = '40000000-0000-4000-8000-000000000002';
const recipient: LetterRecipient = { id: 'owner-b', username: 'moon_flower', characterKey: 'rabbit-moon', palaceName: 'The Moonflower Palace' };
const words = 'A few private words, carried between our palaces.';
const preset: LetterPreset = { id: 'preset_lantern', key: 'lantern-parchment', displayName: 'Royal ivory', description: 'An ivory manuscript.', config: { paperColor: '#F0DDB5', inkColor: '#493622', sealColor: '#874B36', ribbonColor: '#899069', texture: 'parchment', motif: 'royal', font: 'book' } };
const receipt = (requestId = firstId, outcome: DeliveryReceipt['outcome'] = 'DELIVERED', recipientId = recipient.id): DeliveryReceipt => ({ requestId, recipientId, receiptId: `delivery_${'b'.repeat(64)}`, outcome, reason: outcome === 'DELIVERED' ? null : 'CANCELLED', letterId: outcome === 'DELIVERED' ? `delivery_${'b'.repeat(64)}` : null, completedAt: '2026-09-13T00:00:00.000Z' });
function fixture() {
  const values = new Map<string, string>(); let fail = false;
  const storage: DraftStorage = { read: key => values.get(key) ?? null, write: (key, value) => { if (fail) throw new Error('Synthetic local save failure'); values.set(key, value); } };
  const draft = new DraftController('owner-a', storage); draft.load(); draft.choosePreset(preset); draft.edit(words); draft.seal();
  return { draft, storage, values, fail: (value: boolean) => { fail = value; } };
}
const transport = (overrides: Partial<DeliveryTransport> = {}): DeliveryTransport => ({ submit: async input => receipt(input.requestId, 'DELIVERED', input.recipientId), lookup: async () => ({ receipt: null }), cancel: async id => receipt(id, 'REJECTED'), capabilities: async () => ({ textAvailable: true }), ...overrides });

test('throttled delivery preserves its pending draft and allows durable cancellation without sending again', async () => {
  const f = fixture(); let sends = 0;
  const delivery = new DeliveryController(f.draft, transport({ submit: async () => { sends++; throw Object.assign(new Error('Wait'), { status: 429 }); } }), () => firstId);
  await delivery.confirm(recipient); assert.equal(f.draft.getSnapshot().draft!.stage, 'delivery-pending'); assert.equal(f.draft.getSnapshot().draft!.text, words); assert.match(delivery.getSnapshot().error!, /minute/);
  await delivery.check(); assert.equal(sends, 1); assert.equal(f.draft.reset(), false);
  await delivery.cancel(); assert.equal(f.draft.getSnapshot().draft!.stage, 'sealed'); assert.equal(f.draft.getSnapshot().draft!.text, words); assert.equal(sends, 1);
});

test('the recipient and pending intent are saved before sending, and failed saves make no request', async () => {
  const f = fixture(); let calls = 0;
  const delivery = new DeliveryController(f.draft, transport({ submit: async input => { calls++; assert.equal(decodeDraft(f.storage.read(f.draft.key), 'owner-a').stage, 'delivery-pending'); assert.equal(input.recipientId, recipient.id); return receipt(); } }), () => firstId);
  f.fail(true); await delivery.confirm(recipient); assert.equal(calls, 0); assert.equal(f.draft.getSnapshot().draft!.stage, 'sealed');
  f.fail(false); f.draft.retrySave(); await delivery.confirm(recipient); assert.equal(calls, 1); assert.equal(f.draft.getSnapshot().draft!.stage, 'delivered'); assert.equal(f.draft.getSnapshot().draft!.text, '');
});
test('an uncertain delivery locks editing, recipient changes, burning and reset; duplicate taps share one send', async () => {
  const f = fixture(); let release = () => {}; let calls = 0;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const delivery = new DeliveryController(f.draft, transport({ submit: async () => { calls++; await waiting; return receipt(); } }), () => firstId);
  const first = delivery.confirm(recipient); const second = delivery.confirm({ ...recipient, id: 'owner-c' }); assert.equal(first, second);
  f.draft.edit('Changed'); f.draft.unseal(); assert.equal(f.draft.reset(), false); assert.equal(f.draft.beginBurn(secondId), false);
  assert.equal(f.draft.getSnapshot().draft!.deliveryRecipient!.id, recipient.id); assert.equal(f.draft.getSnapshot().draft!.text, words);
  release(); await first; assert.equal(calls, 1); assert.equal(f.draft.getSnapshot().draft!.text, '');
});
test('reload after a lost reply checks a receipt without sending the letter again', async () => {
  const f = fixture(); let sends = 0;
  const api = transport({ submit: async () => { sends++; throw new Error('Lost reply after acceptance'); }, lookup: async () => ({ receipt: receipt() }) });
  const delivery = new DeliveryController(f.draft, api, () => firstId); await delivery.confirm(recipient);
  assert.equal(f.draft.getSnapshot().draft!.stage, 'delivery-pending');
  const restored = new DraftController('owner-a', f.storage); restored.load(); const resumed = new DeliveryController(restored, api, () => secondId); await resumed.check();
  assert.equal(sends, 1); assert.equal(restored.getSnapshot().draft!.stage, 'delivered'); assert.equal(restored.getSnapshot().draft!.text, '');
});
test('unknown status never unlocks a letter; a durable cancellation restores it and the next send uses a new ID', async () => {
  const f = fixture(); let next = 0; const sent: string[] = [];
  const api = transport({ submit: async input => { sent.push(input.requestId); throw new Error('Offline'); } });
  const delivery = new DeliveryController(f.draft, api, () => next++ ? secondId : firstId);
  await delivery.confirm(recipient); await delivery.check(); assert.equal(f.draft.getSnapshot().draft!.stage, 'delivery-pending');
  await delivery.cancel(); assert.equal(f.draft.getSnapshot().draft!.stage, 'sealed'); assert.equal(f.draft.getSnapshot().draft!.text, words); assert.equal(f.draft.getSnapshot().draft!.deliveryRecipient, null);
  await delivery.confirm(recipient); assert.deepEqual(sent, [firstId, secondId]);
});
test('if delivery wins a cancel race, its accepted receipt clears the local text instead of reopening it', async () => {
  const f = fixture(); const delivery = new DeliveryController(f.draft, transport({ submit: async () => { throw new Error('Lost acknowledgement'); }, cancel: async () => receipt() }), () => firstId);
  await delivery.confirm(recipient); await delivery.cancel(); assert.equal(f.draft.getSnapshot().draft!.stage, 'delivered'); assert.equal(f.draft.getSnapshot().draft!.text, '');
});
test('mismatched recipients, request IDs and malformed outcomes cannot clear or unlock a pending page', async () => {
  for (const invalid of [receipt(secondId), receipt(firstId, 'DELIVERED', 'owner-c'), { ...receipt(), letterId: null }, { ...receipt(firstId, 'REJECTED'), reason: 'unknown' }]) {
    const f = fixture(); const delivery = new DeliveryController(f.draft, transport({ submit: async () => invalid as DeliveryReceipt }), () => firstId);
    await delivery.confirm(recipient); assert.equal(f.draft.getSnapshot().draft!.stage, 'delivery-pending'); assert.equal(f.draft.getSnapshot().draft!.text, words);
  }
});
test('cleanup failure clears memory while preserving a recoverable pending fence on disk', async () => {
  const f = fixture(); const delivery = new DeliveryController(f.draft, transport({ submit: async () => { f.fail(true); return receipt(); } }), () => firstId);
  await delivery.confirm(recipient); assert.equal(f.draft.getSnapshot().draft!.stage, 'delivered'); assert.equal(f.draft.getSnapshot().draft!.text, ''); assert.equal(f.draft.getSnapshot().save, 'error'); assert.equal(f.draft.reset(), false);
  const restored = new DraftController('owner-a', f.storage); restored.load(); assert.equal(restored.getSnapshot().draft!.stage, 'delivery-pending'); restored.unseal(); assert.equal(restored.getSnapshot().draft!.stage, 'delivery-pending');
  f.fail(false); delivery.retryCleanup(); assert.equal(f.draft.getSnapshot().save, 'saved'); assert.equal(decodeDraft(f.storage.read(f.draft.key), 'owner-a').text, '');
});
test('stale editors cannot retarget a pending letter, and late replies cannot erase a newer generation', async () => {
  const f = fixture(); const stale = new DraftController('owner-a', f.storage); stale.load();
  f.draft.beginDelivery(firstId, recipient); stale.unseal(); assert.equal(stale.getSnapshot().draft!.stage, 'delivery-pending');
  assert.equal(stale.beginDelivery(secondId, { ...recipient, id: 'owner-c' }), false);
  const newer = { ...newDraft('owner-a', 'newer-page'), text: 'A different page' }; f.storage.write(f.draft.key, JSON.stringify(newer));
  assert.equal(f.draft.applyDeliveryReceipt(receipt()), true); assert.equal(f.draft.getSnapshot().draft!.text, 'A different page');
  assert.equal(decodeDraft(f.storage.read(f.draft.key), 'owner-a').generationId, 'newer-page');
});
test('version-2 drafts migrate to the delivery-capable format without losing sealed words or burn state', () => {
  const f = fixture(); const old = { ...f.draft.getSnapshot().draft!, version: 2 };
  const restored = decodeDraft(JSON.stringify(old), 'owner-a'); assert.equal(restored.version, 6); assert.equal(restored.stage, 'sealed'); assert.equal(restored.text, words); assert.equal(restored.generationId, old.generationId);
  const burning = decodeDraft(JSON.stringify({ ...old, stage: 'burn-pending', burnRequestId: firstId }), 'owner-a'); assert.equal(burning.stage, 'burn-pending'); assert.equal(burning.burnRequestId, firstId);
  assert.throws(() => decodeDraft(JSON.stringify({ ...old, stage: 'delivery-pending', deliveryRequestId: firstId, deliveryRecipient: recipient }), 'owner-a'));
});
test('recipient snapshots and notification destinations discard extra data and require the correct owner', () => {
  assert.deepEqual(cleanRecipient({ ...recipient, authProviderId: 'never-keep' }), recipient);
  assert.equal(cleanRecipient({ ...recipient, characterKey: 'https://untrusted.test' }), null);
  assert.ok(readDeliveryReceipt(receipt(), firstId, recipient.id));
  const event = { type: 'LETTER_DELIVERED', ownerId: 'owner-b', screen: 'inbox', eventId: 'delivery-notice', letterId: receipt().letterId };
  assert.deepEqual(notificationDestination(event, 'owner-b'), { eventId: 'delivery-notice', screen: 'inbox' });
  assert.equal(notificationDestination(event, 'owner-a'), null); assert.equal(notificationDestination({ ...event, screen: 'https://untrusted.test' }, 'owner-b'), null);
});
