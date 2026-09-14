import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BurnReceipt, DeliveryReceipt, LetterPreset } from '@lantern-post/shared-types';
import { AmbientMotionStore } from '../src/storybook/ambient-motion-store';
import { DraftController } from '../src/letters/draft';
import type { DraftStorage } from '../src/letters/draft';
const id = '50000000-0000-4000-8000-000000000001';
const preset: LetterPreset = { id: 'preset_lantern', key: 'lantern-parchment', displayName: 'Royal ivory', description: 'A royal page.', config: { paperColor: '#F0DDB5', inkColor: '#493622', sealColor: '#874B36', ribbonColor: '#899069', texture: 'parchment', motif: 'royal', font: 'book' } };
function fixture() {
  let value: string | null = null; let fail = false;
  const storage: DraftStorage = { read: () => value, write: (_key, next) => { if (fail) throw new Error('Device save failed'); value = next; } };
  const draft = new DraftController('owner-a', storage); draft.openDesk(); draft.choosePreset(preset); draft.edit('Words that should leave the writing desk.'); draft.seal();
  return { draft, storage, fail: () => { fail = true; } };
}
test('ambient motion starts enabled and preserves the explicit choice across new views and reloads', () => {
  let value: string | null = null; const storage = { read: () => value, write: (next: string) => { value = next; } };
  const first = new AmbientMotionStore(storage); assert.equal(first.getSnapshot(), true);
  first.setEnabled(false); assert.equal(new AmbientMotionStore(storage).getSnapshot(), false);
  first.setEnabled(true); assert.equal(new AmbientMotionStore(storage).getSnapshot(), true);
});
test('failed preference storage does not prevent the manual motion switch taking effect', () => {
  const store = new AmbientMotionStore({ read: () => { throw new Error('Unavailable'); }, write: () => { throw new Error('Unavailable'); } });
  assert.equal(store.getSnapshot(), true); store.setEnabled(false); store.refresh(); assert.equal(store.getSnapshot(), false);
});
test('opening the desk after a completed burn creates a fresh generation instead of restoring the Burning World', () => {
  const f = fixture(); f.draft.beginBurn(id);
  const receipt: BurnReceipt = { requestId: id, receiptId: `burn_${'c'.repeat(64)}`, outcome: 'BURNED', reason: null, completedAt: new Date().toISOString() };
  f.draft.applyBurnReceipt(receipt); const oldGeneration = f.draft.getSnapshot().draft!.generationId;
  const reopened = new DraftController('owner-a', f.storage); reopened.openDesk();
  assert.equal(reopened.getSnapshot().draft!.stage, 'writing'); assert.equal(reopened.getSnapshot().draft!.text, ''); assert.notEqual(reopened.getSnapshot().draft!.generationId, oldGeneration);
});
test('opening after confirmed friend delivery also starts a new page', () => {
  const f = fixture(); f.draft.beginDelivery(id, { id: 'owner-b', username: 'friend_b', characterKey: 'rabbit-moon', palaceName: 'Moonflower' });
  const receipt: DeliveryReceipt = { requestId: id, receiptId: `delivery_${'d'.repeat(64)}`, recipientId: 'owner-b', outcome: 'DELIVERED', letterId: `delivery_${'d'.repeat(64)}`, reason: null, completedAt: new Date().toISOString() };
  f.draft.applyDeliveryReceipt(receipt); const reopened = new DraftController('owner-a', f.storage); reopened.openDesk(); assert.equal(reopened.getSnapshot().draft!.stage, 'writing');
});
test('opening the desk never discards unresolved receipts or a pending cleanup fence', () => {
  const f = fixture(); f.draft.beginBurn(id); const reopened = new DraftController('owner-a', f.storage); reopened.openDesk(); assert.equal(reopened.getSnapshot().draft!.stage, 'burn-pending');
  f.fail(); f.draft.applyBurnReceipt({ requestId: id, receiptId: `burn_${'e'.repeat(64)}`, outcome: 'BURNED', reason: null, completedAt: new Date().toISOString() });
  const afterFailure = new DraftController('owner-a', f.storage); afterFailure.openDesk(); assert.equal(afterFailure.getSnapshot().draft!.stage, 'burn-pending'); assert.equal(afterFailure.reset(), false);
});
