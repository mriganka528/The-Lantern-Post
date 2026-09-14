import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { forwardFixtureApi } from './browser-api-proxy.mjs';

export async function checkSocial({ page, backend, output, errors, requests, uploads, setModeration }) {
  const textWarnings = [];
  const captureTextWarning = message => { if (/Unexpected text node:|Text strings must be rendered within/.test(message.text())) textWarnings.push(message.text()); };
  page.on('console', captureTextWarning);
  const button = (p, name) => p.getByRole('button', { name, exact: true });
  const input = p => p.getByRole('textbox', { name: 'Your chat message', exact: true });
  const url = new URL(page.url()); url.search = '?screen=friends';
  const init = () => {
    window.__copies = []; window.__shares = []; window.__visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__visibility });
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__copies.push(text); } } });
    Object.defineProperty(navigator, 'share', { configurable: true, value: async value => { window.__shares.push(value); throw new DOMException('Fixture cancelled', 'AbortError'); } });
  };
  await page.addInitScript(init); await page.goto(url.href);
  await button(page, 'Find their palace').waitFor();
  assert.deepEqual(textWarnings, [], 'Opening the court with an empty search must not render raw text inside a View.');
  await button(page, 'Share my username').click(); await button(page, 'Copy username').click(); assert.deepEqual(await page.evaluate(() => window.__copies), ['@alice']); await button(page, 'Share username').click();
  const card = (await page.evaluate(() => window.__shares))[0]; assert.deepEqual(Object.keys(card).sort(), ['text', 'title']); assert.ok(card.text.includes('@alice')); assert.ok(!card.text.includes('owner-alice')); assert.ok(!card.text.includes('localhost'));
  await page.waitForTimeout(350); await page.screenshot({ path: resolve(output, '01-royal-calling-card.png') }); await button(page, 'Close dialog').last().click();
  await page.getByRole('textbox', { name: "Friend's username", exact: true }).fill('@bob'); await button(page, 'Find their palace').click(); await button(page, "Open bob's gate").waitFor();
  await button(page, 'Close search').click();
  assert.equal(await page.getByRole('textbox', { name: "Friend's username", exact: true }).inputValue(), '');
  assert.deepEqual(textWarnings, [], 'Clearing the search must not render an empty string inside a View.');
  await page.getByRole('textbox', { name: "Friend's username", exact: true }).fill('@bob'); await button(page, 'Find their palace').click(); await button(page, "Open bob's gate").click();
  setModeration('unavailable'); await button(page, 'Chat with bob').click(); await page.getByText(/Live chat is temporarily unavailable/).waitFor(); assert.equal(await button(page, 'Send message').getAttribute('aria-disabled'), 'true');
  await input(page).fill('Keep this real draft while previewing.');
  const posts = () => requests.filter(r => r.method === 'POST' && r.path.includes('/chat/') && r.path.endsWith('/messages')).length;
  const beforeSample = posts(); await button(page, 'Explore sample conversation').click(); await page.getByRole('textbox', { name: 'Sample chat message', exact: true }).fill('A hello inside the sample room.'); await button(page, 'Send sample message').click(); await page.getByText(/This is a scripted sample reply/).waitFor(); assert.equal(posts(), beforeSample); assert.equal(backend.fixture.state.chatMessages.length, 0);
  await page.screenshot({ path: resolve(output, '02-labelled-sample-parlour.png') }); await button(page, 'Return to live chat').click(); assert.equal(await input(page).inputValue(), 'Keep this real draft while previewing.');
  setModeration('approve'); await button(page, 'Check live chat availability').click(); await page.waitForFunction(() => { const send = document.querySelector('[aria-label="Send message"]'); return send && send.getAttribute('aria-disabled') !== 'true'; });
  const otherContext = await page.context().browser().newContext({ viewport: { width: 1280, height: 1000 } }); await otherContext.addInitScript(init); const bob = await otherContext.newPage();
  try {
    bob.on('pageerror', error => errors.push(error.message));
    bob.on('console', captureTextWarning);
    await bob.route(/^https?:\/\//, async route => { const url = new URL(route.request().url()); if (url.origin !== 'https://api.example.invalid') return route.abort(); requests.push({ path: url.pathname, method: route.request().method(), body: route.request().postData() }); return forwardFixtureApi(route, backend.url + url.pathname + url.search, bob); });
    const bobUrl = new URL(url); bobUrl.search = '?owner=bob&screen=friends'; await bob.goto(bobUrl.href); await button(bob, "Open alice's friendship gate").click(); await button(bob, 'Chat with alice').click(); await input(bob).waitFor();
    await input(page).fill('A real-time hello from the rose court.'); await button(page, 'Send message').click(); await bob.getByText('A real-time hello from the rose court.', { exact: true }).waitFor({ timeout: 5000 });
    await input(bob).fill('A reply beneath the palace lanterns.'); await button(bob, 'Send message').click(); await page.getByText('A reply beneath the palace lanterns.', { exact: true }).waitFor({ timeout: 5000 }); assert.equal(backend.fixture.state.chatMessages.length, 2);
    await page.getByTestId('chat-transcript').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '03-live-friend-parlour.png') });
    // Lose one successful acknowledgement and hold receipt lookups until reload.
    const sendBodies = [];
    await page.route('**/chat/owner-bob/messages', async route => { sendBodies.push(JSON.parse(route.request().postData())); await route.fetch({ url: backend.url + '/chat/owner-bob/messages' }); return route.abort('internetdisconnected'); });
    await page.route('**/chat/owner-bob/requests/*', route => route.abort('internetdisconnected'));
    await input(page).fill('A message whose reply was interrupted.'); await button(page, 'Send message').click(); await button(page, 'Cancel sending and keep words').waitFor();
    await page.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith('lantern-chat-v1-') && JSON.parse(localStorage.getItem(key)).requestId));
    await page.waitForTimeout(200); assert.equal(sendBodies.length, 1); assert.equal(backend.fixture.state.chatMessages.length, 3);
    await page.unroute('**/chat/owner-bob/messages'); await page.unroute('**/chat/owner-bob/requests/*'); await page.reload(); await button(page, "Open bob's friendship gate").click(); await button(page, 'Chat with bob').click(); await input(page).waitFor();
    await page.waitForFunction(() => document.querySelector('[aria-label="Your chat message"]').value === ''); assert.equal(backend.fixture.state.chatMessages.length, 3); assert.equal(sendBodies.length, 1);
    // Backgrounding stops further polling and foregrounding catches up safely.
    await page.evaluate(() => { window.__visibility = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); }); const pollCount = requests.filter(r => r.path === '/chat/owner-bob/poll').length; await page.waitForTimeout(400); assert.equal(requests.filter(r => r.path === '/chat/owner-bob/poll').length, pollCount);
    await page.evaluate(() => { window.__visibility = 'visible'; document.dispatchEvent(new Event('visibilitychange')); }); await input(page).waitFor();
    await bob.setViewportSize({ width: 390, height: 844 }); await bob.getByTestId('chat-transcript').scrollIntoViewIfNeeded(); await bob.screenshot({ path: resolve(output, '04-phone-chat.png') }); assert.ok(await bob.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await button(bob, 'Report message 1').click(); await bob.getByRole('radio', { name: 'Spam or unwanted promotion', exact: true }).click(); await bob.getByRole('checkbox', { name: 'Also block alice', exact: true }).click(); await button(bob, 'Save report and block sender').click(); await button(bob, 'Return to the parlour').click();
    await bob.getByText('These gates are closed.', { exact: true }).waitFor(); await page.getByText('These gates are closed.', { exact: true }).waitFor(); assert.equal(await page.getByTestId('chat-transcript').count(), 0); assert.equal(backend.fixture.state.chatReports.length, 1);
  } finally { await bob.unrouteAll({ behavior: 'ignoreErrors' }); await otherContext.close(); }
  // Inspect the redesigned sealed-letter controls without choosing delivery.
  await page.evaluate(() => window.__phase10.setScreen('writing')); await page.getByRole('textbox', { name: 'Your letter', exact: true }).fill('A synthetic letter beneath a sovereign seal.'); await page.getByRole('radio', { name: 'Sovereign Gold', exact: true }).click(); await page.emulateMedia({ reducedMotion: 'reduce' });
  const lettersBefore = requests.filter(r => r.method === 'POST' && r.path === '/letters').length; await button(page, 'Seal my letter').click(); await page.getByTestId('royal-destination-court').waitFor();
  for (const label of ['Send to the Infinity World', "Send to a friend's gate", 'Let it go to the fire']) assert.equal(await button(page, label).count(), 1);
  await page.getByTestId('royal-destination-court').screenshot({ path: resolve(output, '05-royal-destination-court.png') }); await page.setViewportSize({ width: 390, height: 844 }); await button(page, 'Send to the Infinity World').scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '06-phone-destination-court.png') });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); assert.equal(requests.filter(r => r.method === 'POST' && r.path === '/letters').length, lettersBefore); assert.equal(uploads.length, 0); assert.deepEqual(errors, []);
  await button(page, 'Return to my palace').click(); await page.getByText('Welcome home, alice.', { exact: true }).waitFor();
  if (await button(page, 'Skip to my palace').isVisible()) await button(page, 'Skip to my palace').click();
  for (const size of [{ width: 1440, height: 1100 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size); await page.getByTestId('home-writing-desk').scrollIntoViewIfNeeded();
    const ordered = []; for (const id of ['home-writing-desk', 'home-friendship-gates', 'home-worlds', 'home-companion']) ordered.push((await page.getByTestId(id).boundingBox()).y);
    assert.ok(ordered.every((top, i) => i === 0 || top > ordered[i - 1]));
    await page.screenshot({ path: resolve(output, size.width > 600 ? '07-home-section-order.png' : '08-phone-home-order.png') });
  }
  assert.deepEqual(textWarnings, [], 'Friendship and chat navigation must stay free of raw View text warnings.');
  await writeFile(resolve(output, 'checks.json'), JSON.stringify({ checkedAt: new Date().toISOString(), passed: true, checks: ['no-raw-view-text-on-empty-or-cleared-search', 'public-username-only-copy-share', 'username-search', 'accepted-gate-chat-entry', 'moderation-gated-live-chat', 'labelled-no-send-sample', 'two-browser-live-conversation', 'lost-reply-recovery', 'background-pause', 'recipient-report-and-block', 'closed-transcript-cleared', 'three-illustrated-destinations', 'phone-layout', 'sealing-never-sends'] }, null, 2) + '\n');
  console.log('Social browser checks passed: calling-card share/search, moderated real-time two-account chat, no-send samples, receipt recovery, background pause, reports/blocks, illustrated destinations and writing-first home order on desktop/phone.');
}
