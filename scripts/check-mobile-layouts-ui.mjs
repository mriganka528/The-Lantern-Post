import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { forwardFixtureApi } from './browser-api-proxy.mjs';

export async function checkMobileLayouts({ page, backend, output, errors, requests }) {
  const button = name => page.getByRole('button', { name, exact: true });
  const warnings = [];
  page.on('console', message => { if (message.text().includes('Unexpected text node')) warnings.push(message.text()); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByText('Welcome home, alice.', { exact: true }).waitFor();
  if (await button('Skip to my palace').isVisible()) await button('Skip to my palace').click();
  async function audit(name) {
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: page overflow`);
    const failures = await page.getByRole('button').evaluateAll(nodes => nodes.flatMap(node => {
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return [];
      return r.left < -1 || r.right > innerWidth + 1 ? [{ label: node.getAttribute('aria-label') || node.textContent, left: r.left, right: r.right }] : [];
    }));
    assert.deepEqual(failures, [], `${name}: controls outside the phone`);
  }
  for (const width of [320, 360, 390, 430, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const heading = page.getByText('The friendship gates', { exact: true });
    await heading.scrollIntoViewIfNeeded();
    const box = await heading.boundingBox();
    assert.ok(box.width >= 200 && box.height < 75, `${width}: friendship title squeezed`);
    const action = page.getByRole('button', { name: /The friendship court/ });
    const actionBox = await action.boundingBox();
    assert.ok(actionBox.height >= 44 && actionBox.height <= 48, `${width}: home action size`);
    await audit(`home ${width}`);
    if (width === 360) await page.getByTestId('home-friendship-gates').screenshot({ path: resolve(output, '01-phone-friendship.png') });
  }
  await page.setViewportSize({ width: 360, height: 800 });
  for (const screen of ['friends', 'chat', 'privacy', 'gallery', 'inbox']) {
    await page.evaluate(screen => window.__phase10.setScreen(screen), screen);
    await page.waitForTimeout(500);
    for (const width of [320, 360, 430]) { await page.setViewportSize({ width, height: 800 }); await page.waitForTimeout(100); await audit(`${screen} ${width}`); }
    await page.setViewportSize({ width: 360, height: 800 });
    await page.screenshot({ path: resolve(output, `02-phone-${screen}.png`) });
  }
  await page.evaluate(() => window.__phase10.setScreen('writing'));
  await page.getByRole('textbox', { name: 'Your letter', exact: true }).fill('A little light for a smaller screen.');
  for (const width of [320, 360, 430]) {
    await page.setViewportSize({ width, height: 800 }); await page.waitForTimeout(100); await audit(`writing desk ${width}`);
    for (const label of ['My palace', 'My letters', 'New letter']) assert.ok((await button(label).boundingBox()).height <= 48, `${width}: desk navigation wraps`);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await button('My letters').click();
  await page.getByText('Your letters, kept with care.', { exact: true }).waitFor();
  await audit('letter cabinet');
  await button('Close dialog').last().click();
  await page.getByRole('tab', { name: 'A voice letter', exact: true }).click();
  await button('Use a voice letter').click();
  await audit('voice composer');
  await page.getByRole('tab', { name: 'A written letter', exact: true }).click();
  await page.getByRole('textbox', { name: 'Your letter', exact: true }).fill('A little light for a smaller screen.');
  await button('Seal my letter').click();
  await button('Share a copy').waitFor();
  await audit('sealed letter and destination court');
  for (const width of [320, 360, 430]) {
    await page.setViewportSize({ width, height: 800 }); await page.waitForTimeout(100); await audit(`destination court ${width}`);
    for (const label of ['Send to the Infinity World', "Send to a friend's gate", 'Let it go to the fire']) assert.ok((await button(label).boundingBox()).height < 230, `${width}: oversized destination choice`);
  }
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByTestId('royal-destination-court').evaluate(node => node.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: resolve(output, '03-phone-destinations.png') });

  async function seed(who, signed, words, x, y) {
    const response = await fetch(backend.url + '/letters', { method: 'POST', headers: { Authorization: 'Bearer ' + who, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID(), destinationType: 'INFINITY', type: 'TEXT', textContent: words, presetId: 'preset_lantern', isSigned: signed, publicConfirmed: true }) });
    assert.equal(response.status, 200);
    const receipt = await response.json(); const row = backend.fixture.state.letters.find(letter => letter.id === receipt.letterId);
    row.posX = x; row.posY = y; assert.equal(row.moderationSkipped, true); return row;
  }
  const unsigned = await seed('bob', false, 'An unnamed light opens on a phone.', 780, 340);
  const signed = await seed('carol', true, 'A signed letter opens on a phone.', 960, 600);
  await page.evaluate(() => window.__phase10.setScreen('world'));
  const star = page.getByTestId('world-star-' + unsigned.id);
  await star.waitFor();
  const nightView = page.getByRole('radio', { name: 'Night view', exact: true });
  const dayView = page.getByRole('radio', { name: 'Day view', exact: true });
  assert.equal(await nightView.getAttribute('aria-checked'), 'true');
  await page.getByTestId('infinity-night-sky').waitFor();
  await page.getByTestId('infinity-world').screenshot({ path: resolve(output, '05-night-sky-phone.png') });
  // Switching the view is local presentation: keep the camera and motion choice,
  // and never publish or mutate the unfinished letter.
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  const motion = page.getByRole('switch', { name: 'Infinity World ambient motion', exact: true });
  if (await motion.getAttribute('aria-checked') === 'true') await motion.tap();
  await button('Zoom into the sky').tap();
  const beforePose = await star.boundingBox();
  const sendsBefore = requests.filter(r => r.path === '/letters' && r.method === 'POST').length;
  await dayView.tap(); await page.getByTestId('infinity-day-sky').waitFor();
  assert.equal(await page.getByText('125%', { exact: true }).count(), 1);
  assert.deepEqual(await star.boundingBox(), beforePose);
  assert.equal(await motion.getAttribute('aria-checked'), 'false');
  assert.equal(await dayView.getAttribute('aria-checked'), 'true');
  await button('Reset sky view').tap();
  await page.getByTestId('infinity-world').screenshot({ path: resolve(output, '06-day-sky-phone.png') });
  const reloadWorld = new URL(page.url()); reloadWorld.searchParams.set('screen', 'world');
  await page.goto(reloadWorld.href);
  await star.waitFor(); assert.equal(await nightView.getAttribute('aria-checked'), 'true');
  assert.equal(await motion.getAttribute('aria-checked'), 'false');
  assert.equal(requests.filter(r => r.path === '/letters' && r.method === 'POST').length, sendsBefore);
  await audit('day/night switch on phone');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await dayView.tap();
  await star.tap();
  await page.getByText(unsigned.textContent, { exact: true }).waitFor();
  assert.equal(await page.getByText('bob', { exact: true }).count(), 0);
  await audit('public letter reader');
  await page.screenshot({ path: resolve(output, '04-phone-infinity-reader.png') });
  await button('Return to the stars').tap();
  await nightView.tap();
  await page.getByTestId('world-star-' + signed.id).tap();
  await page.getByText('SIGNED BY @carol', { exact: true }).waitFor();
  await button('Return to the stars').tap();

  // A same-account transport refresh must not restart an in-flight open.
  let opens = 0;
  const delayedOpen = async route => {
    opens++; await new Promise(done => setTimeout(done, 900));
    const url = new URL(route.request().url());
    await forwardFixtureApi(route, backend.url + url.pathname, page);
  };
  await page.route('**/infinity/stars/*/open', delayedOpen);
  await star.tap(); await page.getByText('Opening this little light…', { exact: true }).waitFor();
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__phase10.refreshTransport()); await page.waitForTimeout(100); }
  await page.getByText(unsigned.textContent, { exact: true }).waitFor(); assert.equal(opens, 1);
  await button('Return to the stars').tap(); await page.unroute('**/infinity/stars/*/open', delayedOpen);

  const emptyOpen = route => route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
  await page.route('**/infinity/stars/*/open', emptyOpen);
  await star.tap(); await button('Try opening this light again').waitFor();
  await button('Return to the stars').tap(); await page.unroute('**/infinity/stars/*/open', emptyOpen);

  // Reproduce an authentication promise that never resolves, before fetch starts.
  const before = requests.filter(r => r.path.endsWith('/open')).length;
  await page.evaluate(() => { window.__phase10.holdWorldToken = true; });
  await star.tap(); await page.getByText('Opening this little light…', { exact: true }).waitFor();
  await button('Try opening this light again').waitFor({ timeout: 18000 });
  assert.equal(requests.filter(r => r.path.endsWith('/open')).length, before);
  await page.evaluate(() => { window.__phase10.holdWorldToken = false; });
  await button('Try opening this light again').tap();
  await page.getByText(unsigned.textContent, { exact: true }).waitFor();
  await button('Return to the stars').tap();
  await button('Explore sample stars').tap();
  await page.getByTestId('world-star-sample-2').tap();
  await page.getByText('PREVIEW LETTER · NOT A COMMUNITY MESSAGE', { exact: true }).waitFor();
  await button('Return to the stars').tap(); await button('Return to the shared sky').tap();
  await button('Zoom into the sky').tap(); await audit('zoomed sky');
  await button('Reset sky view').tap(); await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByTestId('infinity-world').screenshot({ path: resolve(output, '07-night-sky-desktop.png') });
  assert.deepEqual(errors, []); assert.deepEqual(warnings, []);
  console.log('Mobile checks passed: 320–1440px layouts; night/day rendering, night restored on a fresh visit, unchanged camera/motion and no send on switching; touch opening unsigned/signed/sample lights in both views; transport refresh during opening; stalled authentication timeout and successful retry.');
}
