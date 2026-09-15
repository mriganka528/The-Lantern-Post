import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, test } from 'node:test';
import type { ChatPage, ChatReceipt } from '@lantern-post/shared-types';
import { createFriendsTestApp } from './friends-fixture';
import { PalaceEvents } from '../src/realtime/palace-events';
let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
before(async () => { context = await createFriendsTestApp(false, undefined, undefined, 'disabled'); });
beforeEach(() => { context.fixture.reset(); context.fixture.state.requests.push({ id: 'friends', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date(), respondedAt: new Date() }); });
after(async () => context.app.close());
const request = (path: string, who = 'alice', body?: unknown) => fetch(context.url + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...(who ? { Authorization: 'Bearer ' + who } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
async function sent() {
  const input = { requestId: randomUUID(), text: 'Only the people in this conversation may keep these words.', confirmed: true };
  const result = await request('/chat/owner-bob/messages', 'alice', input); assert.equal(result.status, 200);
  return { input, receipt: await result.json() as ChatReceipt };
}
const remove = (id: string, who: string, scope: 'self' | 'everyone') => request('/chat/messages/' + id + '/remove', who, { confirmed: true, scope });
const history = async (who: string) => (await (await request('/chat/owner-' + (who === 'alice' ? 'bob' : 'alice'), who)).json()) as ChatPage;

test('delete for me hides only that participant and clears shared text only after both delete', async () => {
  const { input, receipt } = await sent();
  assert.equal((await remove(receipt.messageId!, 'bob', 'self')).status, 200);
  assert.equal((await history('bob')).messages.length, 0);
  assert.equal((await history('alice')).messages[0]!.text, input.text);
  assert.equal((await context.app.get(PalaceEvents).inbox('owner-bob')).events.length, 0);
  const before = context.fixture.state.events.length;
  assert.equal((await remove(receipt.messageId!, 'bob', 'self')).status, 200);
  assert.equal(context.fixture.state.events.length, before, 'retries do not create new events');
  assert.equal((await remove(receipt.messageId!, 'alice', 'self')).status, 200);
  assert.equal((await history('alice')).messages.length, 0);
  assert.equal(context.fixture.state.chatMessages[0]!.text, '');
  assert.equal(context.fixture.state.chatReceipts[0]!.messageId, receipt.messageId);
});
test('unsend belongs only to the sender, updates both sides, and preserves original UUID receipts', async () => {
  const { input, receipt } = await sent();
  assert.equal((await remove(receipt.messageId!, 'bob', 'everyone')).status, 403);
  assert.equal((await remove(receipt.messageId!, 'carol', 'everyone')).status, 404);
  assert.equal((await remove(receipt.messageId!, 'alice', 'everyone')).status, 200);
  for (const who of ['alice', 'bob']) {
    const messages = (await history(who)).messages;
    assert.equal(messages[0]!.removed, true); assert.equal(messages[0]!.text, 'This message was unsent.');
    assert.equal(messages[0]!.sequence, receipt.sequence);
  }
  assert.equal(context.fixture.state.chatMessages[0]!.text, '');
  assert.deepEqual(await (await request('/chat/owner-bob/messages', 'alice', input)).json(), receipt);
  assert.equal(context.fixture.state.chatMessages.length, 1); assert.equal(context.fixture.state.chatMessages[0]!.text, '');
  assert.ok(context.fixture.state.events.some(event => event.kind === 'CHAT_CHANGED' && event.ownerId === 'owner-bob'));
  assert.equal((await context.app.get(PalaceEvents).inbox('owner-bob')).events.length, 0);
  assert.equal((await request('/chat/messages/' + receipt.messageId + '/report', 'bob', { confirmed: true, reason: 'SPAM', blockSender: false })).status, 404);
});
test('removal and snapshots enforce authentication, confirmation, bounds and current open gates', async () => {
  const { receipt } = await sent(), id = receipt.messageId!;
  assert.equal((await remove(id, '', 'self')).status, 401);
  for (const body of [{ scope: 'self' }, { scope: 'everyone', confirmed: false }, { scope: 'self', confirmed: true, ownerId: 'owner-bob' }]) assert.equal((await request('/chat/messages/' + id + '/remove', 'alice', body)).status, 400);
  assert.equal((await request('/chat/owner-bob/sync', '', { ids: [id] })).status, 401);
  assert.equal((await request('/chat/owner-bob/sync', 'alice', { ids: [id, id] })).status, 400);
  assert.equal((await request('/chat/owner-bob/sync', 'alice', { ids: Array.from({ length: 201 }, () => 'chatmsg_' + randomUUID()) })).status, 400);
  const snapshot = await request('/chat/owner-bob/sync', 'alice', { ids: [id, 'chatmsg_' + randomUUID()] });
  assert.equal(snapshot.status, 200); assert.equal((await snapshot.json() as ChatPage).messages.length, 1);
  context.fixture.state.blocks.push({ blockerId: 'owner-bob', blockedId: 'owner-alice' });
  assert.equal((await request('/chat/owner-bob/sync', 'alice', { ids: [id] })).status, 404);
  assert.equal((await remove(id, 'alice', 'everyone')).status, 404);
});
