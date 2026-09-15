import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { forwardFixtureApi } from './browser-api-proxy.mjs';

export async function checkPalaceBell({ page, backend, output, errors }) {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const bob = await context.newPage(); const button = name => bob.getByRole('button', { name, exact: true });
  const bell = () => bob.getByTestId('palace-notification-bell');
  const badge = count => bob.waitForFunction(count => (document.querySelector('[data-testid="palace-notification-badge"]')?.textContent ?? '0') === String(count), count);
  const notice = id => bob.getByTestId('bell-notice-' + id);
  const eventFor = item => backend.fixture.state.events.find(event => event.ownerId === 'owner-bob' && event.itemId === item);
  const request = async (path, body, who = 'alice') => {
    const response = await fetch(backend.url + path, { method: 'POST', headers: { Authorization: 'Bearer ' + who, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(response.status, 200); return response.json();
  };
  const message = text => request('/chat/owner-bob/messages', { requestId: randomUUID(), text, confirmed: true });
  async function home() {
    await bob.getByText('Welcome home, bob.', { exact: true }).waitFor();
    if (await button('Skip to my palace').isVisible()) await button('Skip to my palace').click();
    await bob.waitForFunction(() => window.__phase10.connected());
  }
  try {
    bob.on('pageerror', error => errors.push(error.message));
    await bob.route(/^https?:\/\//, route => { const url = new URL(route.request().url()); return url.origin === 'https://api.example.invalid' ? forwardFixtureApi(route, backend.url + url.pathname + url.search, bob) : route.abort(); });
    const url = new URL(page.url()); url.search = '?owner=bob'; await bob.goto(url.href); await home();
    await badge(0); assert.equal(await bell().count(), 1);
    await bob.evaluate(() => window.__phase10.setScreen('friends'));
    await bob.getByRole('switch', { name: 'In-app arrival alerts', exact: true }).click();
    await bob.evaluate(() => window.__phase10.setScreen('home')); await home();
    const letter = await request('/letters', { requestId: randomUUID(), type: 'TEXT', destinationType: 'FRIEND', recipientId: 'owner-bob', presetId: 'preset_lantern', textContent: 'PRIVATE_BELL_LETTER_WORDS', deliveryConfirmed: true });
    const chat = await message('PRIVATE_BELL_CHAT_WORDS'); await badge(2);
    assert.equal(await bob.getByTestId('palace-arrival-alert').count(), 0);
    await bob.getByTestId('royal-page-navigation').screenshot({ path: resolve(output, '01-vintage-bell-header-phone.png') });
    await bell().click(); await notice(eventFor(letter.letterId).id).waitFor(); await notice(eventFor(chat.messageId).id).waitFor();
    const rows = await bob.locator('[data-testid^="bell-notice-"]').allTextContents(); assert.ok(!rows.join('').includes('PRIVATE_BELL'));
    await bob.screenshot({ path: resolve(output, '02-letter-and-chat-notifications.png') });
    await badge(0);
    async function swipe(id,direction) {
      await notice(id).scrollIntoViewIfNeeded(); const box=await notice(id).boundingBox();
      const x=box.x+box.width*(direction>0?.25:.75),y=box.y+box.height*.7;
      await bob.mouse.move(x,y);await bob.mouse.down();await bob.mouse.move(x+direction*115,y+3,{steps:12});await bob.mouse.up();
      await notice(id).waitFor({state:'detached'});
    }
    await swipe(eventFor(chat.messageId).id,1);
    assert.ok(backend.fixture.state.chatMessages.some(m=>m.id===chat.messageId),'dismissal keeps the message');
    const leftDismiss=await message('Dismiss this notice to the left.');await notice(eventFor(leftDismiss.messageId).id).waitFor();await badge(0);await swipe(eventFor(leftDismiss.messageId).id,-1);
    await button('Close the bells').click();
    await Promise.all([bob.waitForResponse(response => response.url().endsWith('/notifications/inbox') && response.status() === 200), bob.reload()]); await home(); await badge(0);
    await bell().click(); assert.equal(await notice(eventFor(chat.messageId).id).count(),0,'dismissal persists after reload'); await notice(eventFor(letter.letterId).id).click();
    await button('Open letter from alice, unopened').click(); await button('Break the seal').click(); await bob.getByText('PRIVATE_BELL_LETTER_WORDS', { exact: true }).waitFor();
    await button('Remove this letter').click(); await button('Remove from my letterbox').click();
    await bell().click(); await bob.waitForFunction(id => !document.querySelector(`[data-testid="bell-notice-${id}"]`), eventFor(letter.letterId).id); await button('Close the bells').click();
    const next = await message('A second whisper for the bell.'); await badge(1); await bell().click(); await notice(eventFor(next.messageId).id).click();
    await bob.getByTestId('chat-transcript').getByText('A second whisper for the bell.', { exact: true }).waitFor(); await badge(0);
    await message('Already visible in this open chat.'); await bob.getByTestId('chat-transcript').getByText('Already visible in this open chat.', { exact: true }).waitFor(); await badge(0);
    for(let i=0;i<10;i++)await message('Scrollable earlier message '+i);
    const transcript=bob.getByTestId('chat-transcript');await transcript.getByText('Scrollable earlier message 9',{exact:true}).waitFor();await transcript.scrollIntoViewIfNeeded();
    await transcript.hover();const beforeScroll=await transcript.evaluate(el=>el.scrollTop);assert.ok(beforeScroll>0);
    await bob.mouse.wheel(0,-1100);await bob.waitForFunction(before=>document.querySelector('[data-testid="chat-transcript"]').scrollTop<before,beforeScroll);
    const readingAt=await transcript.evaluate(el=>el.scrollTop);await message('Arrives while reading earlier messages.');await transcript.getByText('Arrives while reading earlier messages.',{exact:true}).waitFor({state:'attached'});await bob.waitForTimeout(100);
    assert.ok(await transcript.evaluate(el=>el.scrollTop)<=readingAt+2,'new arrivals do not jump away from earlier messages');
    // An arrival older than the popup window still appears after reopening.
    await bob.goto('about:blank'); const missed = await message('A message while the palace was closed.'); eventFor(missed.messageId).createdAt = new Date(Date.now() - 3600000);
    await bob.goto(url.href); await home(); await badge(1); await bell().click(); await notice(eventFor(missed.messageId).id).waitFor(); await button('Close the bells').click();
    for (const width of [320, 390, 1440]) {
      await bob.setViewportSize({ width, height: 900 }); await bob.waitForTimeout(120); await bell().scrollIntoViewIfNeeded();
      const box = await bell().boundingBox(); assert.equal(box.width, 44); assert.equal(box.height, 44); assert.ok(box.x >= 0 && box.x + box.width <= width);
      assert.ok(await bob.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await bob.getByTestId('royal-page-navigation').screenshot({ path: resolve(output, '03-vintage-bell-header-desktop.png') });
    await bob.setViewportSize({ width: 320, height: 800 }); await bob.evaluate(() => window.__phase10.setScreen('writing'));
    await bob.getByRole('textbox', { name: 'Your letter', exact: true }).waitFor(); assert.equal(await bell().count(), 1);
    await bob.getByTestId('royal-workspace-navigation').screenshot({ path: resolve(output, '04-writing-desk-bell.png') });
    // The bell must obey the desk's unsaved-word fence before navigating away.
    await bob.evaluate(() => { const storage = window.__phase10.draftStorage; window.__bellWrite = storage.write; storage.write = (key, value) => { if (key.startsWith('lantern-draft-v1-owner-bob') || key.startsWith('lantern-letter-v1-owner-bob--')) throw Error('Synthetic full disk'); window.__bellWrite(key, value); }; });
    await bob.getByRole('textbox', { name: 'Your letter', exact: true }).fill('Keep these unsaved words when the bell rings.');
    await bell().click(); await bob.getByText('Keep this page open until your latest changes can be saved.', { exact: true }).waitFor();
    assert.equal(await bob.getByText('The palace bells', { exact: true }).count(), 0);
    await bob.evaluate(() => { window.__phase10.draftStorage.write = window.__bellWrite; });
    await bell().click(); await notice(eventFor(missed.messageId).id).click();
    await bob.getByRole('textbox', { name: 'Your chat message', exact: true }).waitFor();
    await bob.evaluate(() => window.__phase10.setScreen('writing'));
    assert.equal(await bob.getByRole('textbox', { name: 'Your letter', exact: true }).inputValue(), 'Keep these unsaved words when the bell rings.');
    await request('/safety/blocks/owner-alice', { confirmed: true }, 'bob'); await badge(0); await bell().click(); await bob.getByTestId('palace-notifications-empty').waitFor(); await button('Close the bells').click();
    await bob.evaluate(() => window.__phase10.setOwner('alice')); await bob.getByText('Welcome home, alice.', { exact: true }).waitFor();
    if (await button('Skip to my palace').isVisible()) await button('Skip to my palace').click();
    await bell().click(); await bob.getByTestId('palace-notifications-empty').waitFor();
    assert.deepEqual(errors, []);
    console.log('Palace bell checks passed: mark seen on open, both swipe directions, persistent dismissals without deleting messages, scrollable chat history without forced jumps, live badges, independent letter deletion, active-chat suppression, offline arrivals, account isolation and navigation guards.');
  } finally { await bob.unrouteAll({ behavior: 'ignoreErrors' }); await context.close(); }
}
