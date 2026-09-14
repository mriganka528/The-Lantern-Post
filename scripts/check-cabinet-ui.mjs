import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { browserDraft } from './browser-letter-storage.mjs';

export async function checkCabinet({ page, backend, output, errors, requests, uploads }) {
  const button = name => page.getByRole('button', { name, exact: true });
  const editor = page.getByRole('textbox', { name: 'Your letter', exact: true });
  const stored = () => page.evaluate(browserDraft, 'owner-alice');
  const activeKey = () => page.evaluate(() => { const id = localStorage.getItem('lantern-letter-choice-v1-owner-alice'); return id === 'original' ? 'lantern-draft-v1-owner-alice' : 'lantern-letter-v1-owner-alice--' + id; });
  async function enter(p) { await p.getByText('Welcome home, alice.', { exact: true }).waitFor(); await p.getByRole('button', { name: 'Skip to my palace', exact: true }).click(); await p.getByRole('button', { name: /Open the writing desk/ }).click(); await p.getByRole('textbox', { name: 'Your letter', exact: true }).waitFor(); }
  await enter(page); await editor.fill('A manuscript I want to keep.'); await page.getByRole('radio', { name: 'Royal Moonlace', exact: true }).click(); const keep = await stored(); const keepKey = await activeKey();
  await button('New letter').click(); await editor.fill('A page I no longer need.'); const removeKey = await activeKey(); const before = JSON.stringify(await stored());
  assert.equal(await button('My palace').count(), 1);
  await page.getByText('A letter, by candlelight.', { exact: true }).scrollIntoViewIfNeeded(); await page.screenshot({ path: resolve(output, '01-royal-desk-navigation.png') });
  const nav = button('My letters'); await page.mouse.move(0, 0); const plain = await nav.evaluate(e => getComputedStyle(e).backgroundColor); await nav.hover(); assert.notEqual(await nav.evaluate(e => getComputedStyle(e).backgroundColor), plain);
  await nav.focus(); assert.notEqual(await nav.evaluate(e => getComputedStyle(e).outlineStyle), 'none'); await page.keyboard.press('Enter');
  await button('Remove A page I no longer need.').waitFor(); await page.waitForTimeout(350); await page.screenshot({ path: resolve(output, '02-cabinet-with-removal.png') });
  await button('Remove A page I no longer need.').click(); await button('Keep this letter').click(); assert.equal(JSON.stringify(await stored()), before);
  // A second real window keeps the old editor mounted during removal.
  const other = await page.context().newPage();
  try {
    other.on('pageerror', error => errors.push(error.message));
    await other.route(/^https?:\/\//, async route => { const url = new URL(route.request().url()); if (url.origin !== 'https://api.example.invalid') return route.abort(); const response = await route.fetch({ url: backend.url + url.pathname + url.search }); return route.fulfill({ response, headers: { ...response.headers(), 'Access-Control-Allow-Origin': '*' } }); });
    await other.goto(page.url()); await enter(other); assert.equal(await other.getByRole('textbox', { name: 'Your letter', exact: true }).inputValue(), 'A page I no longer need.');
    await page.bringToFront();
    await page.evaluate(() => { const original = Storage.prototype.setItem; window.__failRemoval = true; Storage.prototype.setItem = function(key, value) { if (window.__failRemoval && value.startsWith('{"type":"removed-letter"')) throw new DOMException('Synthetic quota failure', 'QuotaExceededError'); return original.call(this, key, value); }; });
    await button('Remove A page I no longer need.').click(); await page.waitForTimeout(350); await page.screenshot({ path: resolve(output, '03-removal-confirmation.png') }); await button('Remove letter').click();
    await page.getByText('The letter could not be removed. It has been kept; please try again.', { exact: true }).waitFor(); assert.equal(JSON.stringify(await stored()), before);
    await page.evaluate(() => { window.__failRemoval = false; }); await button('Remove letter').click(); await page.getByText('Room for new words.', { exact: true }).waitFor();
    const marker = await page.evaluate(key => localStorage.getItem(key), removeKey); assert.ok(marker.includes('removed-letter')); assert.ok(!marker.includes('A page I no longer need.'));
    await other.bringToFront(); await other.getByText('Room for new words.', { exact: true }).waitFor(); assert.equal(await other.getByRole('textbox', { name: 'Your letter', exact: true }).count(), 0);
  } finally { await other.close(); }
  await page.bringToFront(); await button('My letters').click(); assert.equal(await button('Remove A page I no longer need.').count(), 0); await button('Open A manuscript I want to keep.').click();
  assert.equal(await editor.inputValue(), keep.text); assert.equal((await stored()).preset.id, keep.preset.id); assert.equal(await activeKey(), keepKey);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await button('Seal my letter').click(); await button('My letters').click(); await button('Remove A manuscript I want to keep.').click(); await button('Remove letter').click(); await page.getByText('Room for new words.', { exact: true }).waitFor();
  await button('My letters').click(); await page.getByText('The cabinet is quiet. A fresh page is here whenever you need it.', { exact: true }).waitFor(); await button('Start another letter').click();
  assert.notEqual(await activeKey(), keepKey); assert.notEqual(await activeKey(), removeKey);
  await page.getByRole('tab', { name: 'A voice letter', exact: true }).click(); await button('Record my voice').click(); await button('Stop recording').waitFor(); assert.equal(await button('My letters').getAttribute('aria-disabled'), 'true'); await page.waitForTimeout(2100); await button('Stop recording').click(); await button('Play voice letter').waitFor();
  await page.getByRole('textbox', { name: 'Words to read with your voice, optional', exact: true }).fill('This caption must leave with the recording.'); const voice = await stored(); const voiceKey = await activeKey();
  await button('My letters').click(); await button('Remove A voice letter').click(); await button('Remove letter').click(); await page.getByText('Room for new words.', { exact: true }).waitFor();
  await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).voiceDeletes.length === 0, voiceKey);
  assert.ok(!(await page.evaluate(key => localStorage.getItem(key), voiceKey)).includes('This caption'));
  const keys = await page.evaluate(() => new Promise((resolve, reject) => { const open = indexedDB.open('lantern-voice-v1'); open.onerror = () => reject(Error('Could not inspect fixture recordings')); open.onsuccess = () => { const db = open.result; const request = db.transaction('clips').objectStore('clips').getAllKeys(); request.onsuccess = () => { resolve(request.result); db.close(); }; request.onerror = () => { db.close(); reject(Error('Could not inspect fixture recordings')); }; }; })); assert.ok(keys.every(key => !String(key).includes(voice.voice.id)));
  await button('New letter').click(); await editor.fill('A fresh page after removal.');
  // An inactive, durably pending fixture is listed without a remove control or
  // any automatic send. It uses a separate UUID and contains synthetic words.
  const pendingId = await page.evaluate(() => { const active = localStorage.getItem('lantern-letter-choice-v1-owner-alice'); const d = JSON.parse(localStorage.getItem('lantern-letter-v1-owner-alice--' + active)); const id = crypto.randomUUID(); localStorage.setItem('lantern-letter-v1-owner-alice--' + id, JSON.stringify({ ...d, generationId: crypto.randomUUID(), stage: 'burn-pending', text: 'Hidden pending fixture.', sealedAt: new Date().toISOString(), burnRequestId: crypto.randomUUID() })); return id; });
  await button('My letters').click(); const pendingCard = page.getByTestId('cabinet-letter-' + pendingId); await pendingCard.waitFor(); assert.equal(await pendingCard.getByRole('button', { name: /^Remove / }).count(), 0); assert.equal(await page.getByText('Hidden pending fixture.', { exact: true }).count(), 0);
  await button('Close dialog').last().click(); await page.setViewportSize({ width: 390, height: 844 }); await page.getByText('A letter, by candlelight.', { exact: true }).scrollIntoViewIfNeeded();
  for (const label of ['My palace', 'My letters', 'New letter']) { const box = await button(label).boundingBox(); assert.ok(box.width >= 44 && box.height >= 44); assert.ok(box.x >= 0 && box.x + box.width <= 390); }
  await page.screenshot({ path: resolve(output, '04-phone-royal-navigation.png') });
  assert.equal(requests.filter(r => r.method === 'POST' && (r.path === '/letters' || r.path.startsWith('/voice/'))).length, 0); assert.equal(uploads.length, 0); assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'checks.json'), JSON.stringify({ checkedAt: new Date().toISOString(), passed: true, checks: ['writing-and-sealed-removal', 'cancel-keeps-draft', 'failed-write-keeps-draft', 'other-letter-stationery-preserved', 'stale-window-fenced', 'last-letter-fresh-page', 'voice-caption-byte-cleanup', 'pending-not-removable', 'no-network-send', 'royal-nav-keyboard-hover', 'phone-touch-targets'] }, null, 2) + '\n');
  console.log('Cabinet browser checks passed: confirmed text/sealed/voice removal, cancellation and storage failure, preserved neighbours, stale-window protection, real local voice cleanup, protected pending letters, no sends, royal navigation and phone layout.');
}
