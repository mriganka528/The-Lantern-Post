import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

export async function checkNotificationStateUi({ open, backend, errors }) {
  const send = async (path, body) => {
    const response = await fetch(backend.url + path, { method: 'POST', headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 200); return response.json();
  };
  const message = text => send('/chat/owner-bob/messages', { requestId: randomUUID(), text, confirmed: true });
  const noticeFor = item => backend.fixture.state.events.find(event => event.ownerId === 'owner-bob' && event.itemId === item);
  const wait = async check => { const until = Date.now() + 10000; while (!check()) { if (Date.now() > until) throw Error('Notification state did not sync'); await new Promise(resolve => setTimeout(resolve, 25)); } };
  const bell = page => page.getByTestId('palace-notification-bell');
  const notice = (page, id) => page.getByTestId('bell-notice-' + id);
  const button = (page, name) => page.getByRole('button', { name, exact: true });
  const close = page => button(page, 'Close the bells').click();
  const first = await message('Keep the first message'), second = await message('Keep the second message');
  const letter = await send('/letters', { requestId: randomUUID(), type: 'TEXT', destinationType: 'FRIEND', recipientId: 'owner-bob', presetId: 'preset_lantern', textContent: 'Keep this letter', deliveryConfirmed: true });
  const a = await open('/bell?who=bob', true); await a.waitForFunction(() => window.__connected());
  await a.getByTestId('palace-notification-badge').getByText('3', { exact: true }).waitFor();
  await bell(a).click(); await notice(a, noticeFor(letter.letterId).id).waitFor();
  await wait(() => [first.messageId, second.messageId, letter.letterId].every(id => noticeFor(id).seenAt));
  await notice(a, noticeFor(letter.letterId).id).click(); await a.getByText('Destination: inbox', { exact: true }).waitFor();
  await bell(a).click(); assert.equal(await notice(a, noticeFor(letter.letterId).id).count(), 0);
  const box = await notice(a, noticeFor(first.messageId).id).boundingBox(); const x = box.x + box.width * .25, y = box.y + box.height * .7;
  await a.mouse.move(x, y); await a.mouse.down(); await a.mouse.move(x + 120, y, { steps: 12 }); await a.mouse.up();
  await notice(a, noticeFor(first.messageId).id).waitFor({ state: 'detached' });
  await wait(() => noticeFor(first.messageId).dismissedAt && noticeFor(letter.letterId).dismissedAt); await close(a);
  // A new context has no device storage: this models reinstalling/signing in.
  const b = await open('/bell?who=bob', true); await b.waitForFunction(() => window.__connected()); await bell(b).click(); await notice(b, noticeFor(second.messageId).id).waitFor();
  assert.equal(await b.locator('[data-testid^="bell-notice-"]').count(), 1); assert.equal(await b.getByTestId('palace-notification-badge').count(), 0); await close(b);
  const newest = await message('A new arrival after reinstall');
  await a.getByTestId('palace-notification-badge').getByText('1', { exact: true }).waitFor();
  await bell(a).click(); await notice(a, noticeFor(newest.messageId).id).waitFor();
  await bell(b).click(); await notice(b, noticeFor(newest.messageId).id).click(); await b.getByText('Destination: chat', { exact: true }).waitFor();
  await notice(a, noticeFor(newest.messageId).id).waitFor({ state: 'detached' });
  // Offline dismissal is durable locally, then uploaded after reconnect.
  let offline = true;
  await a.route('**/notifications/state', route => offline ? route.abort() : route.fallback());
  await button(a, 'Dismiss notification: A whisper at your gate').click();
  await a.getByText('Your choices are saved on this device and waiting to sync to your account. Connect before reinstalling to keep them.', { exact: true }).waitFor();
  assert.equal(noticeFor(second.messageId).dismissedAt, null);
  await a.reload(); await a.waitForFunction(() => window.__connected()); await bell(a).click(); await a.getByTestId('palace-notifications-empty').waitFor();
  await a.getByText('Your choices are saved on this device and waiting to sync to your account. Connect before reinstalling to keep them.', { exact: true }).waitFor();
  offline = false; await button(a, 'Sync notification choices').click(); await wait(() => noticeFor(second.messageId).dismissedAt);
  const clean = await open('/bell?who=bob', true); await bell(clean).click(); await clean.getByTestId('palace-notifications-empty').waitFor();
  const foreign = await open('/bell?who=alice', true); await bell(foreign).click(); await foreign.getByTestId('palace-notifications-empty').waitFor();
  assert.ok(backend.fixture.state.chatMessages.every(row => row.text.startsWith('Keep') || row.text.startsWith('A new')));
  assert.equal(backend.fixture.state.letters[0].textContent, 'Keep this letter'); assert.equal(backend.fixture.state.letters[0].readAt, null);
  assert.deepEqual(errors, []);
  console.log('PASS: opening clears only its notice; swipe dismissal; read/dismiss state restored into clean storage; socket updates across isolated devices; offline dismissal/reload/retry; account isolation and original content preserved.');
}
