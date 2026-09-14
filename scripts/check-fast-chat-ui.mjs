import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { forwardFixtureApi } from './browser-api-proxy.mjs';

export async function checkFastChat({ page, backend, output, errors, requests }) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByText('Welcome home, alice.', { exact: true }).waitFor();
  const skip = page.getByRole('button', { name: 'Skip to my palace', exact: true }); if (await skip.isVisible()) await skip.click();
  const send = async text => {
    const response = await fetch(backend.url + '/chat/owner-alice/messages', { method: 'POST', headers: { Authorization: 'Bearer bob', 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID(), text, confirmed: true }) });
    assert.equal(response.status, 200); return response.json();
  };
  await send('History line 1'); const first = backend.fixture.state.chatMessages[0];
  for (let sequence = 2; sequence <= 70; sequence++) backend.fixture.state.chatMessages.push({ ...first, id: 'chatmsg_' + randomUUID(), sequence, text: 'History line ' + sequence });
  backend.fixture.state.chatThreads[0].nextSequence = 70;
  let legacyReads = 0, socketStarts = 0; const frames = [];
  // Make redundant startup reads deliberately slow: the first conversation
  // must arrive from the socket without waiting for either of these endpoints.
  const slow = async route => { legacyReads++; await new Promise(done => setTimeout(done, 2000)); const url = new URL(route.request().url()); await forwardFixtureApi(route, backend.url + url.pathname + url.search, page); };
  await page.route('**/chat/capabilities', slow); await page.route('**/chat/owner-bob', slow);
  page.on('websocket', socket => { if (!socket.url().endsWith('/chat/socket')) return; socketStarts++; socket.on('framesent', frame => { const data = JSON.parse(String(frame.payload)); frames.push({ after: data.after, type: data.type }); }); });
  const started = performance.now(); await page.evaluate(() => window.__phase10.setScreen('chat'));
  const transcript = page.getByTestId('chat-transcript'); await transcript.getByText('History line 70', { exact: true }).waitFor({ timeout: 1500 });
  const firstConversationMs = Math.round(performance.now() - started);
  assert.equal(legacyReads, 0); assert.equal(socketStarts, 1); assert.equal(frames[0]?.after, null);
  assert.equal(await transcript.locator('[data-testid^="chat-message-"]').count(), 30);
  assert.equal(await transcript.getByText('History line 1', { exact: true }).count(), 0);
  await page.unroute('**/chat/capabilities', slow); await page.unroute('**/chat/owner-bob', slow);
  await page.getByRole('button', { name: 'Earlier messages', exact: true }).click();
  await transcript.getByText('History line 1', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Return to latest messages', exact: true }).click();
  await send('Live words after the fast opening.'); await transcript.getByText('Live words after the fast opening.', { exact: true }).waitFor();
  // A pending receipt lookup must not hold the live conversation hostage.
  await page.evaluate(() => window.__phase10.setScreen('friends'));
  const pendingId = randomUUID();
  await page.evaluate(id => { localStorage.setItem('lantern-chat-v1-' + encodeURIComponent(JSON.stringify(['owner-alice', 'owner-bob'])), JSON.stringify({ version: 1, ownerId: 'owner-alice', peerId: 'owner-bob', text: 'Previously confirmed words.', requestId: id })); }, pendingId);
  let release; let lookups = 0; const held = new Promise(resolve => { release = resolve; });
  const holdReceipt = async route => { lookups++; await held; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ receipt: null }) }).catch(() => {}); };
  await page.route('**/chat/owner-bob/requests/' + pendingId, holdReceipt);
  await page.evaluate(() => window.__phase10.setScreen('chat'));
  await transcript.getByText('History line 70', { exact: true }).waitFor();
  await send('Live even while an old receipt waits.'); await transcript.getByText('Live even while an old receipt waits.', { exact: true }).waitFor();
  assert.equal(lookups, 1); assert.equal(requests.filter(request => request.path === '/chat/owner-bob/messages').length, 0);
  await page.getByRole('button', { name: 'Cancel sending and keep words', exact: true }).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('lantern-chat-v1-' + encodeURIComponent(JSON.stringify(['owner-alice', 'owner-bob'])))).requestId === null);
  await page.evaluate(() => window.__phase10.setScreen('friends')); release(); await page.unroute('**/chat/owner-bob/requests/' + pendingId, holdReceipt);
  // Exercise a failed socket upgrade using the existing HTTP compatibility path.
  await page.routeWebSocket(/\/chat\/socket$/, socket => socket.close());
  const fallbackStart = performance.now(); await page.evaluate(() => window.__phase10.setScreen('chat'));
  await transcript.getByText('History line 70', { exact: true }).waitFor();
  const fallbackMs = Math.round(performance.now() - fallbackStart);
  assert.ok(requests.some(request => request.path === '/chat/owner-bob'));
  await send('A reply through the compatible connection.'); await transcript.getByText('A reply through the compatible connection.', { exact: true }).waitFor({ timeout: 5000 });
  await page.setViewportSize({ width: 390, height: 844 }); await transcript.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '01-fast-parlour-phone.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'opening-check.json'), JSON.stringify({ firstConversationMs, fallbackMs, initialMessages: 30, redundantStartupReads: legacyReads, note: 'Isolated browser/API fixture; these are not production latency guarantees.' }, null, 2));
  console.log(`Fast chat checks passed: first conversation in ${firstConversationMs} ms in the isolated fixture, zero redundant startup reads, thirty recent messages, older pages, live updates and blocked-socket fallback (${fallbackMs} ms).`);
}
