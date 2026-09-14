import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function checkPhase11({ page, backend, output, errors, requests, uploads, characters, root }) {
  const button = name => page.getByRole('button', { name, exact: true });
  const draft = () => page.evaluate(() => { const id = localStorage.getItem('lantern-letter-choice-v1-owner-alice'); return JSON.parse(localStorage.getItem(!id || id === 'original' ? 'lantern-draft-v1-owner-alice' : 'lantern-letter-v1-owner-alice--' + id)); });
  async function home() { await page.getByText('Welcome home, alice.', { exact: true }).waitFor(); if (!await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)) await button('Skip to my palace').click(); }
  await home(); await button('Companions').click(); await page.getByRole('radio', { name: /^Lune,/ }).click(); await button('Begin with Lune').click(); await home();
  assert.equal(await page.getByTestId('flying-dove-0').count(), 0); await page.getByTestId('river-current').waitFor(); assert.equal(await page.getByTestId('palace-angel-0').count(), 1);
  const river = await page.getByTestId('river-current').evaluate(e => getComputedStyle(e).transform); await page.waitForTimeout(350); assert.notEqual(await page.getByTestId('river-current').evaluate(e => getComputedStyle(e).transform), river);
  for (const c of characters) { const art = await readFile(resolve(root, `client/assets/storybook/palace-${c.key}.svg`), 'utf8'); assert.ok(!art.includes('M184 126q12-10')); }
  await page.screenshot({ path: resolve(output, '01-moonflower-no-birds.png') });
  await page.getByRole('button', { name: /Open the writing desk/ }).click();
  await page.getByTestId('desk-companion-rabbit-moon').waitFor(); const editor = page.getByRole('textbox', { name: 'Your letter', exact: true });
  await editor.fill('A first letter, still unfinished.'); await page.getByTestId('companion-writing').waitFor(); await page.getByTestId('desk-companion-rabbit-moon').screenshot({ path: resolve(output, '02-lune-writing.png') });
  await page.waitForTimeout(1500); await page.getByTestId('companion-resting').waitFor(); const first = await draft();
  await button('New letter').click(); await editor.fill('A second letter with moonlace.'); await page.getByRole('radio', { name: 'Royal Moonlace', exact: true }).click();
  const second = await draft(); assert.notEqual(second.generationId, first.generationId);
  await button('My letters').click(); await button('Open A first letter, still unfinished.').click(); assert.equal(await editor.inputValue(), first.text);
  await button('My letters').click(); await page.screenshot({ path: resolve(output, '03-letter-cabinet.png') }); await button('Open A second letter with moonlace.').click(); assert.equal((await draft()).preset.displayName, 'Royal Moonlace');
  const beforeShare = JSON.stringify(await draft()); const sendsBefore = requests.filter(r => r.method === 'POST' && (r.path === '/letters' || r.path.startsWith('/voice/'))).length;
  await button('Share a copy').click(); await page.getByTestId('share-letter-preview').waitFor(); await page.screenshot({ path: resolve(output, '04-share-illustrated-letter.png') });
  const [download] = await Promise.all([page.waitForEvent('download'), button('Save illustrated letter').click()]); await download.saveAs(resolve(output, 'shared-letter.png'));
  const png = await readFile(resolve(output, 'shared-letter.png')); assert.equal(png.readUInt32BE(16), 1080); assert.equal(png.readUInt32BE(20), 1500);
  await button('Keep writing here').click(); assert.equal(JSON.stringify(await draft()), beforeShare);
  // Simulate a system share sheet and its cancellation without sending to an app.
  await page.evaluate(() => { window.__sharedCopies = []; Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true }); Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.__sharedCopies.push({ files: data.files?.map(f => ({ name: f.name, type: f.type, size: f.size })), text: data.text }); throw new DOMException('Cancelled', 'AbortError'); } }); });
  await button('Share a copy').click(); await button('Share illustrated letter').click(); await page.getByText('Sharing cancelled. Your letter is still here.', { exact: true }).waitFor(); await button('Keep writing here').click();
  assert.equal(JSON.stringify(await draft()), beforeShare); assert.equal(requests.filter(r => r.method === 'POST' && (r.path === '/letters' || r.path.startsWith('/voice/'))).length, sendsBefore); assert.equal(uploads.length, 0);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await button('Seal my letter').click(); assert.equal(await page.getByTestId('flying-dove-0').count(), 0); await button('New letter').click(); await editor.fill('The sealed page stays in the cabinet.');
  await button('My letters').click(); await button('Open A second letter with moonlace.').click(); await button('Let it go to the fire').click();
  // Hold only this original operation, then write another page while it waits.
  let release; const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/letters', async route => { await gate; const response = await route.fetch({ url: backend.url + '/letters' }); await route.fulfill({ response, headers: { ...response.headers(), 'Access-Control-Allow-Origin': '*' } }); });
  await button('Burn this letter').click(); await page.waitForFunction(() => { const id = localStorage.getItem('lantern-letter-choice-v1-owner-alice'); return JSON.parse(localStorage.getItem('lantern-letter-v1-owner-alice--' + id)).stage === 'burn-pending'; });
  const pending = await draft(); await button('New letter').click(); await editor.fill('New words survive an earlier receipt.'); release();
  await page.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith('lantern-letter-v1-owner-alice--') && JSON.parse(localStorage.getItem(key)).stage === 'burned'));
  assert.equal((await draft()).text, 'New words survive an earlier receipt.'); assert.equal(backend.fixture.state.burnReceipts.length, 1);
  assert.ok(await page.evaluate(requestId => Object.keys(localStorage).some(key => key.startsWith('lantern-letter-v1-owner-alice--') && JSON.parse(localStorage.getItem(key)).burnReceipt?.requestId === requestId), pending.burnRequestId));
  await page.unroute('**/letters');
  await button('New letter').click(); await page.getByRole('tab', { name: 'A voice letter', exact: true }).click(); await page.emulateMedia({ reducedMotion: 'no-preference' });
  await button('Record my voice').click(); await button('Stop recording').waitFor(); await page.getByTestId('companion-recording').waitFor(); assert.equal(await button('New letter').getAttribute('aria-disabled'), 'true');
  await page.getByTestId('desk-companion-rabbit-moon').screenshot({ path: resolve(output, '05-lune-recording.png') }); await page.waitForTimeout(2200); await button('Stop recording').click(); await button('Play voice letter').waitFor();
  await page.getByTestId('companion-resting').waitFor(); const voice = await draft(); await button('Share a copy').click(); await button('Share recording').click(); await page.getByText('Sharing cancelled. Your letter is still here.', { exact: true }).waitFor();
  const [audio] = await Promise.all([page.waitForEvent('download'), button('Save recording').click()]); await audio.saveAs(resolve(output, 'shared-recording.webm')); assert.equal((await readFile(resolve(output, 'shared-recording.webm'))).length, voice.voice.byteLength);
  assert.equal(await page.locator('audio').evaluateAll(elements => elements.every(el => el.paused)), true); await button('Keep writing here').click(); assert.equal(uploads.length, 0);
  await button('My letters').click(); await button('Open A first letter, still unfinished.').click(); await page.reload(); await home(); await page.getByRole('button', { name: /Open the writing desk/ }).click(); assert.equal(await editor.inputValue(), first.text);
  await page.setViewportSize({ width: 390, height: 844 }); await editor.scrollIntoViewIfNeeded(); await editor.fill('A small-screen letter at my desk.'); await page.getByTestId('companion-writing').waitFor();
  const phoneCompanion = page.locator('[data-testid^="desk-companion-"]');
  await phoneCompanion.scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '07-phone-writing-desk.png') });
  assert.ok((await phoneCompanion.boundingBox()).y < (await editor.boundingBox()).y);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await editor.fill(first.text); const quill = page.getByTestId('companion-writing'); const still = await quill.evaluate(e => getComputedStyle(e).transform); await page.waitForTimeout(300); assert.equal(await quill.evaluate(e => getComputedStyle(e).transform), still);
  await page.setViewportSize({ width: 1440, height: 1200 }); await page.emulateMedia({ reducedMotion: 'no-preference' });
  // Account isolation survives remounts, including the selection and voice list.
  await page.evaluate(() => window.__phase10.setOwner('bob')); await page.getByText('Welcome home, bob.', { exact: true }).waitFor(); await button('Skip to my palace').click(); await page.getByRole('button', { name: /Open the writing desk/ }).click(); assert.equal(await editor.inputValue(), ''); await button('My letters').click(); assert.equal(await page.getByText(first.text, { exact: true }).count(), 0); await button('Close dialog').last().click();
  await page.evaluate(() => window.__phase10.setOwner('alice')); await home(); await button('Account').click(); await button('Terms of Service').click(); await page.getByText(/You must be at least 13 years old/).waitFor(); await page.screenshot({ path: resolve(output, '06-policy-pages.png') });
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'browser-checks.json'), JSON.stringify({ checkedAt: new Date().toISOString(), passed: true, environment: 'Desktop Chromium, local synthetic identities and microphone, no external sharing or live delivery', checks: ['all-palace-birds-removed', 'river-angels-preserved', 'independent-letters', 'pending-late-receipt-fence', 'illustrated-audio-copy', 'share-cancellation', 'no-export-sends', 'writing-recording-companion', 'reload-account-isolation', 'age-13-policy-drafts'] }, null, 2) + '\n');
  console.log('Phase 11 browser checks passed: bird-free Moonflower and ten rebuilt palaces; river/angels; independent drafts, sealed/pending navigation and late receipts; PNG/audio export, cancelled shares without sends; matching writing/recording companion; reload/account isolation; age-13 policy pages.');
}
