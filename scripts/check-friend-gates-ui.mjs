import assert from 'node:assert/strict';
import { resolve } from 'node:path';

// Run with --mobile --friend-gates: real UI/API contracts, synthetic friends only.
export async function checkFriendGates({ page, output, errors, requests, backend, capture = name => page.screenshot({ path: resolve(output, name) }) }) {
  const button = name => page.getByRole('button', { name, exact: true });
  const card = name => page.getByTestId('friend-card-owner-' + name);
  const consoleErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  for (let i = 0; i < 27; i++) {
    const peer = backend.fixture.user(`guest_${String(i).padStart(2, '0')}`); backend.fixture.state.users.push(peer);
    backend.fixture.state.requests.push({ id: `circle-${i}`, fromUserId: i % 2 ? peer.id : 'owner-alice', toUserId: i % 2 ? 'owner-alice' : peer.id, status: 'ACCEPTED', createdAt: new Date(1700000000000 + i), respondedAt: new Date() });
  }
  const longName = 'moonflower_palace_friend';
  const peer = backend.fixture.user(longName); backend.fixture.state.users.push(peer);
  backend.fixture.state.requests.push({ id: 'circle-long-name', fromUserId: 'owner-alice', toUserId: peer.id, status: 'ACCEPTED', createdAt: new Date(Date.now() + 1000), respondedAt: new Date() });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByText('Welcome home, alice.', { exact: true }).waitFor();
  if (await button('Skip to my palace').isVisible()) await button('Skip to my palace').click();
  await page.evaluate(() => window.__phase10.setScreen('friends'));
  await button('Refresh').click();
  await card(longName).waitFor();
  const field = page.getByRole('textbox', { name: 'Search your friends', exact: true });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByText('Your circle of little lights', { exact: true }).evaluate(el => el.scrollIntoView({ block: 'start' }));
    const box = await card(longName).boundingBox();
    const open = await button(`Open ${longName}'s friendship gate`).boundingBox();
    const remove = await button(`Unfriend ${longName}`).boundingBox();
    assert.ok(box.height <= 155, `${width}: compact friend card`);
    assert.ok(remove.y >= open.y + open.height, `${width}: Unfriend never overlaps the gate or name`);
    assert.ok(remove.height >= 44 && remove.width >= 44, `${width}: accessible Unfriend target`);
    assert.ok(remove.y + remove.height <= box.y + box.height, `${width}: Unfriend fits inside its card`);
    const overflowing = await page.getByRole('button').evaluateAll(nodes => nodes.filter(node => {
      const r = node.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1);
    }).map(node => node.getAttribute('aria-label') || node.textContent));
    assert.deepEqual(overflowing, [], `${width}: controls fit the viewport`);
    await capture(`friendship-gates-${width}.png`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await card('guest_00').count(), 0, 'older friend is outside the first page');
  await field.fill(' @GUEST_00 ');
  await card('guest_00').waitFor();
  assert.equal(await page.locator('[data-testid^="friend-card-"]').count(), 1);
  await field.fill('no_match');
  await page.getByText('No friend matches that name.', { exact: true }).waitFor();
  await button('Show all friends').click();
  await card(longName).waitFor();
  await button('Turn another page').click(); await card('guest_00').waitFor();
  assert.equal(await page.locator('[data-testid^="friend-card-"]').count(), 29);
  await field.fill('b'); await card('bob').waitFor();
  await page.getByRole('tab', { name: 'At my gate', exact: true }).click();
  await page.getByText('The gate is quiet, for now.', { exact: true }).waitFor();
  await page.getByRole('tab', { name: 'Friendship gates', exact: true }).click();
  await card('bob').waitFor(); assert.equal(await field.inputValue(), 'b');
  await button("Open bob's friendship gate").click();
  await page.getByTestId('friend-gate-reveal').waitFor();
  await button('Close dialog').last().click();
  const writes = () => requests.filter(request => ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method) && !request.path.startsWith('/diagnostics'));
  assert.deepEqual(writes(), [], 'search and opening gates never mutate a friendship');
  await button('Unfriend bob').click();
  await page.getByText('Unfriend bob?', { exact: true }).waitFor();
  await button('Keep friendship').click(); assert.equal(writes().length, 0);
  await button('Unfriend bob').click(); await button('Confirm unfriend').click();
  await page.getByText('The friendship has been closed. Your letters have not been deleted.', { exact: true }).waitFor();
  await card('bob').waitFor({ state: 'detached' });
  assert.equal(writes().length, 1); assert.equal(writes()[0].path, '/friends/social-friends/remove');
  assert.equal(backend.fixture.state.blocks.length, 0);
  await button('Clear friend search').click(); await card(longName).waitFor();
  await button(`Chat with ${longName}`).click();
  await page.getByText(`A conversation with @${longName}`, { exact: true }).waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
  console.log('Friend gates passed: compact phone/desktop layouts, long names, full-circle search, pagination, tabs, gate opening, direct chat and confirmed unfriend.');
}
