// Offline browser review. Production components and local draft storage are
// real; the release transport is a controlled, content-free receipt fixture.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const clientRequire = createRequire(resolve(root, 'client/package.json'));
const webpack = require('webpack');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../.cache/art-tools/node_modules/playwright')); }
const { serializePreset } = require('../server/dist-test/src/presets/preset.js');
const { serializeCharacter } = require('../server/dist-test/src/characters/catalog.js');
const presetSql = await readFile(resolve(root, 'server/prisma/migrations/20260912020000_seed_stationery/migration.sql'), 'utf8');
const antiqueSql = await readFile(resolve(root, 'server/prisma/migrations/20260912040000_antique_stationery/migration.sql'), 'utf8');
const updates = new Map([...antiqueSql.matchAll(/WHEN '([^']+)' THEN '(\{[^']+\})'::jsonb/g)].map(([, key, json]) => [key, JSON.parse(json)]));
const presets = [...presetSql.matchAll(/\('([^']+)', '([^']+)', '([^']+)', '(\{[^']+\})'::jsonb/g)].map(([, id, key, displayName, json]) => serializePreset({ id, key, displayName, configJson: { ...JSON.parse(json), ...updates.get(key) } }));
assert.equal(presets.length, 6); assert.equal(updates.size, 6); assert.ok(presets.every(Boolean));
const character = serializeCharacter({ id: 'char_fox_lantern', key: 'fox-lantern', displayName: 'Ember', assetUrl: 'bundled://characters/fox-lantern' });
const output = resolve(root, '.cache/phase4-review'); await mkdir(output, { recursive: true });
const entry = resolve(root, '.cache/phase4-ui-entry.tsx');
const loader = resolve(root, '.cache/phase4-tsx-loader.cjs');
await writeFile(loader, `const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;};`);
await writeFile(entry, `
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppRegistry } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WritingDesk } from '../client/src/letters/writing-desk';
import { PalaceHome } from '../client/src/storybook/palace-home';
const presets = ${JSON.stringify(presets)};
const character = ${JSON.stringify(character)};
const fixture = { mode: 'normal', sent: [], blocked: false, blockPrepare: false, release: () => {} };
const originalSet = Storage.prototype.setItem;
Storage.prototype.setItem = function(key, value) {
  if (key.startsWith('lantern-draft-v1-') && (fixture.blockPrepare || (fixture.blocked && JSON.parse(value).stage === 'burned'))) throw new Error('Synthetic storage failure');
  return originalSet.call(this, key, value);
};
function transport(owner) {
  return {
    async submit(request) {
      fixture.sent.push({ owner, requestId: request.requestId });
      const count = Number(localStorage.getItem('fixture-submit-count') || 0);
      localStorage.setItem('fixture-submit-count', String(count + 1));
      const key = 'fixture-receipt-' + owner + '-' + request.requestId;
      const old = localStorage.getItem(key); if (old) return JSON.parse(old);
      const mode = fixture.mode;
      if (mode === 'offline') throw new Error('Synthetic offline condition');
      if (mode === 'hold') await new Promise(resolve => { fixture.release = resolve; });
      const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner + ':' + request.requestId));
      const id = 'burn_' + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
      const rejected = mode === 'reject';
      const receipt = { requestId: request.requestId, receiptId: id, outcome: rejected ? 'REJECTED' : 'BURNED', reason: rejected ? 'PRESET_UNAVAILABLE' : null, completedAt: new Date().toISOString() };
      localStorage.setItem(key, JSON.stringify(receipt));
      if (mode === 'cleanup') fixture.blocked = true;
      if (mode === 'lost') throw new Error('Synthetic lost success response');
      return receipt;
    },
    async lookup(requestId) {
      const raw = localStorage.getItem('fixture-receipt-' + owner + '-' + requestId);
      return { receipt: raw ? JSON.parse(raw) : null };
    }
  };
}
function Fixture() {
  const [screen, setScreen] = useState('writing');
  const [owner, setOwner] = useState('review-a');
  const api = useMemo(() => transport(owner), [owner]);
  const back = useCallback(() => setScreen('home'), []);
  useEffect(() => { window.__phase4 = { fixture, setOwner, setScreen }; }, []);
  useEffect(() => { window.__phase4.screen = screen; }, [screen]);
  return <SafeAreaProvider>{screen === 'writing' ? <WritingDesk key={owner} ownerId={owner} presets={presets} burnTransport={api} onRetryCatalog={() => {}} onBack={back} /> : <PalaceHome character={character} username="starlit_soul" onCompanions={() => {}} onAccount={() => {}} onWrite={() => setScreen('writing')} />}</SafeAreaProvider>;
}
AppRegistry.registerComponent('Phase4Review', () => () => <React.StrictMode><Fixture /></React.StrictMode>);
AppRegistry.runApplication('Phase4Review', { rootTag: document.getElementById('root') });
`);
const compiler = webpack({ mode: 'development', devtool: false, target: 'web', entry, output: { path: output, filename: 'bundle.js' },
  resolve: { extensions: ['.web.tsx', '.tsx', '.web.ts', '.ts', '.web.js', '.js', '.mjs', '.json'], alias: {
    'react-native$': clientRequire.resolve('react-native-web'), react: dirname(clientRequire.resolve('react/package.json')), 'react-dom': dirname(clientRequire.resolve('react-dom/package.json')),
  } },
  module: { rules: [{ test: /\.tsx?$/, use: loader }, { test: /\.(png|jpg)$/, type: 'asset/inline' }] },
  plugins: [new webpack.DefinePlugin({ __DEV__: 'true', 'process.env': JSON.stringify({ NODE_ENV: 'development', EXPO_OS: 'web' }), 'process.env.NODE_ENV': JSON.stringify('development') })], performance: { hints: false }, stats: 'errors-only',
});
await new Promise((resolve, reject) => compiler.run((error, stats) => { compiler.close(() => {}); if (error || stats.hasErrors()) reject(error || new Error(stats.toString('errors-only'))); else resolve(); }));
await writeFile(resolve(output, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;height:100%;width:100%}#root{display:flex}body{background:#F8F4EA}</style></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>');
console.log('Phase 4 offline browser fixture compiled.');
const browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = []; page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.route(/^https?:\/\//, route => route.abort());
  await page.goto(pathToFileURL(resolve(output, 'index.html')).href);
  const words = 'Dear little world,\n\nSome thoughts belong to the fire. I am ready to lay this one down, and take a little peace home with me.';
  const letter = page.getByRole('textbox', { name: 'Your letter' });
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('lantern-draft-v1-review-a')));
  const count = () => page.evaluate(() => Number(localStorage.getItem('fixture-submit-count') || 0));
  const viewport = page.getByTestId('realm-viewport');
  const zoom = async () => Number.parseFloat(await page.getByTestId('realm-zoom-level').innerText());
  const cameraTransform = () => page.getByTestId('realm-camera').evaluate(e => getComputedStyle(e).transform);
  const opacity = id => page.getByTestId(id).evaluate(e => Number(getComputedStyle(e).opacity));
  async function toConfirmation() {
    await page.getByRole('button', { name: 'Seal my letter' }).click();
    await page.getByRole('button', { name: 'Let it go to the fire' }).click();
    await page.getByRole('button', { name: 'Burn this letter', exact: true }).waitFor();
  }
  async function atHome() {
    if (await page.evaluate(() => window.__phase4.screen !== 'home')) {
      await page.getByText('A little lighter, now.', { exact: true }).waitFor({ timeout: 18000 });
      await page.getByRole('button', { name: 'Return to my palace', exact: true }).click();
    }
    await page.waitForFunction(() => window.__phase4.screen === 'home', undefined, { timeout: 5000 });
    const skip = page.getByRole('button', { name: 'Skip to my palace' });
    if (await skip.count()) await skip.click();
  }
  async function newLetter(text = words) {
    await page.getByRole('button', { name: /Open the writing desk/ }).click();
    await letter.waitFor(); assert.equal(await letter.inputValue(), ''); await letter.fill(text);
    await toConfirmation();
  }
  await letter.waitFor(); await letter.fill(words);
  for (const p of presets) { const radio = page.getByRole('radio', { name: p.displayName, exact: true }); await radio.click(); assert.equal(await radio.getAttribute('aria-checked'), 'true'); }
  await page.getByRole('radio', { name: 'Royal ivory', exact: true }).click();
  await page.getByText('Lantern Post', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, '01-antique-writing-desk.png') });
  await toConfirmation();
  await page.screenshot({ path: resolve(output, '02-burning-world-confirmation.png') });
  // Exploring the world never submits or changes the sealed letter.
  assert.equal(await zoom(), 100);
  assert.equal(await page.getByRole('button', { name: 'Zoom out', exact: true }).isDisabled(), true);
  assert.equal(await page.getByTestId('fire-guardian').count(), 1);
  assert.equal(await page.getByTestId('realm-ambient-flames').count(), 1);
  assert.equal(await opacity('burn-flames'), 0);
  const motion = page.getByRole('switch', { name: 'Ambient fire animation' });
  await motion.click(); assert.equal(await motion.getAttribute('aria-checked'), 'false');
  const stillGuardian = await page.getByTestId('fire-guardian').evaluate(e => getComputedStyle(e).transform);
  await page.waitForTimeout(220);
  assert.equal(await page.getByTestId('fire-guardian').evaluate(e => getComputedStyle(e).transform), stillGuardian);
  await motion.click(); assert.equal(await motion.getAttribute('aria-checked'), 'true');
  await page.getByRole('button', { name: 'Focus on the fire guardian' }).click(); assert.equal(await zoom(), 180);
  await viewport.screenshot({ path: resolve(output, '07-fire-guardian-closeup.png') });
  await page.getByRole('button', { name: 'Focus on the letter' }).click(); assert.equal(await zoom(), 235);
  await page.waitForTimeout(250); await viewport.scrollIntoViewIfNeeded();
  const beforeDrag = await cameraTransform();
  const desktopBox = await viewport.boundingBox();
  await page.mouse.move(desktopBox.x + desktopBox.width / 2, desktopBox.y + desktopBox.height / 2);
  await page.mouse.down(); await page.mouse.move(desktopBox.x + desktopBox.width / 2 + 120, desktopBox.y + desktopBox.height / 2 + 45, { steps: 8 }); await page.mouse.up();
  assert.notEqual(await cameraTransform(), beforeDrag);
  await viewport.focus(); await page.keyboard.press('0'); assert.equal(await zoom(), 100);
  await page.keyboard.press('+'); assert.equal(await zoom(), 125);
  await page.waitForTimeout(220); const beforeKeys = await cameraTransform();
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(50); assert.notEqual(await cameraTransform(), beforeKeys);
  await viewport.dispatchEvent('wheel', { deltaY: -65, clientX: desktopBox.x + 300, clientY: desktopBox.y + 300 }); assert.ok(await zoom() > 125);
  await page.getByRole('button', { name: 'Reset world view' }).click();
  await viewport.dispatchEvent('wheel', { deltaY: -50 }); assert.equal(await zoom(), 100, 'Unfocused wheel must allow page scrolling.');
  await viewport.dispatchEvent('wheel', { deltaY: -75, ctrlKey: true, clientX: desktopBox.x + 300, clientY: desktopBox.y + 300 }); assert.ok(await zoom() > 100);
  await viewport.focus();
  for (let i = 0; i < 10; i++) await page.keyboard.press('+');
  assert.equal(await zoom(), 300); assert.equal(await page.getByRole('button', { name: 'Zoom in', exact: true }).isDisabled(), true);
  await page.getByRole('button', { name: 'Reset world view' }).click(); assert.equal(await zoom(), 100);
  assert.equal(await count(), 0);
  await page.getByRole('button', { name: 'Keep my letter' }).click();
  await page.getByRole('button', { name: 'Open my letter again' }).click();
  assert.equal(await letter.inputValue(), words); assert.equal(await count(), 0);
  await toConfirmation();
  await page.evaluate(() => { window.__phase4.fixture.blockPrepare = true; });
  await page.getByRole('button', { name: 'Burn this letter', exact: true }).click();
  await page.getByText('Your letter could not be prepared for release. Save it and try again.', { exact: true }).waitFor();
  assert.equal(await count(), 0);
  await page.getByRole('button', { name: 'Keep my letter' }).click();
  await page.evaluate(() => { window.__phase4.fixture.blockPrepare = false; });
  await page.getByRole('button', { name: 'Retry saving' }).click();
  await page.getByRole('button', { name: 'Let it go to the fire' }).click();
  await page.evaluate(() => { window.__phase4.fixture.mode = 'hold'; });
  await page.getByRole('button', { name: 'Burn this letter', exact: true }).click();
  await page.getByText('Waiting for the fire…', { exact: true }).waitFor();
  assert.equal(await page.getByTestId('burn-flames').evaluate(e => getComputedStyle(e).opacity), '0');
  assert.equal((await stored()).stage, 'burn-pending'); assert.equal(await letter.count(), 0);
  const burnStarted = Date.now(); await page.evaluate(() => window.__phase4.fixture.release());
  await page.getByRole('button', { name: 'Skip the burn animation' }).waitFor();
  assert.equal((await stored()).text, '');
  await page.waitForFunction(() => {
    const column = document.querySelector('[data-testid="paper-burn-column-7"]');
    const ash = [...document.querySelector('[data-testid="burn-ash"]').children];
    return new DOMMatrix(getComputedStyle(column).transform).m42 < -90 &&
      Number(getComputedStyle(document.querySelector('[data-testid="burn-envelope"]')).opacity) === 1 &&
      Number(getComputedStyle(document.querySelector('[data-testid="burn-flames"]')).opacity) > .8 &&
      ash.some(fragment => Number(getComputedStyle(fragment).opacity) > .3);
  }, undefined, { timeout: 9000 });
  await page.getByRole('button', { name: 'Focus on the letter' }).click();
  await page.waitForTimeout(250); await viewport.screenshot({ path: resolve(output, '03-letter-becoming-embers.png') });
  await page.getByText('A little lighter, now.', { exact: true }).waitFor({ timeout: 9000 });
  assert.ok(Date.now() - burnStarted >= 10000, 'The full burn must progress slowly before completion.');
  assert.equal(await opacity('burn-envelope'), 0); assert.equal(await opacity('settled-ashes'), 1);
  await page.waitForTimeout(1200); assert.equal(await page.evaluate(() => window.__phase4.screen), 'writing', 'The completed realm stays open for exploration.');
  await viewport.screenshot({ path: resolve(output, '08-settled-ashes.png') });
  await atHome(); assert.equal((await stored()).stage, 'writing'); assert.equal((await stored()).text, '');
  // Finishing an old account's request must not clear or navigate a new account.
  await newLetter(); await page.evaluate(() => { window.__phase4.fixture.mode = 'hold'; });
  await page.getByRole('button', { name: 'Burn this letter', exact: true }).click();
  await page.getByText('Waiting for the fire…', { exact: true }).waitFor();
  await page.evaluate(() => window.__phase4.setOwner('review-b'));
  await letter.fill('This page belongs to the second account.');
  await page.evaluate(() => window.__phase4.fixture.release());
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('lantern-draft-v1-review-a')).stage === 'burned');
  assert.equal(await letter.inputValue(), 'This page belongs to the second account.');
  assert.equal(await page.evaluate(() => window.__phase4.screen), 'writing');
  await page.evaluate(() => window.__phase4.setOwner('review-a')); await atHome();
  // Lost acknowledgement, reload, and receipt-only recovery.
  await newLetter(); await page.evaluate(() => { window.__phase4.fixture.mode = 'lost'; });
  const beforeLost = await count(); await page.getByRole('button', { name: 'Burn this letter', exact: true }).click();
  await page.getByRole('button', { name: 'Retry this release', exact: true }).waitFor(); assert.equal((await stored()).stage, 'burn-pending');
  await page.reload(); await atHome(); assert.equal(await count(), beforeLost + 1); assert.equal((await stored()).text, '');
  // Durable rejection preserves the sealed letter.
  await newLetter(); await page.evaluate(() => { window.__phase4.fixture.mode = 'reject'; });
  await page.getByRole('button', { name: 'Burn this letter', exact: true }).click();
  await page.getByRole('button', { name: 'Open my letter again' }).waitFor();
  assert.equal((await stored()).stage, 'sealed'); assert.equal((await stored()).text, words);
  await page.getByRole('button', { name: 'Open my letter again' }).click();
  await page.getByRole('radio', { name: 'Moonflower', exact: true }).click();
  await toConfirmation(); await page.evaluate(() => { window.__phase4.fixture.mode = 'cleanup'; });
  await page.getByRole('button', { name: 'Burn this letter', exact: true }).click();
  await page.getByRole('button', { name: 'Finish clearing this letter' }).waitFor();
  assert.equal(await letter.count(), 0); assert.equal((await stored()).stage, 'burn-pending');
  assert.equal(await page.getByTestId('burn-flames').evaluate(e => getComputedStyle(e).opacity), '0');
  await page.evaluate(() => { window.__phase4.fixture.blocked = false; });
  await page.getByRole('button', { name: 'Finish clearing this letter' }).click();
  await page.getByRole('button', { name: 'Skip the burn animation' }).click(); await atHome(); assert.equal((await stored()).text, '');
  // Phone styling and reduced-motion release.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Open the writing desk/ }).click(); await letter.fill(words);
  await page.screenshot({ path: resolve(output, '04-antique-letter-phone.png') });
  await page.getByRole('radio', { name: 'Royal ivory', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, '05-stationery-cabinet-phone.png') });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await toConfirmation();
  // Browser touch events follow the same pointer path used by phones/tablets.
  const touchSession = await page.context().newCDPSession(page);
  await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await viewport.scrollIntoViewIfNeeded();
  const phoneBox = await viewport.boundingBox(); const cx = phoneBox.x + phoneBox.width / 2; const cy = phoneBox.y + phoneBox.height / 2;
  const touches = spread => [{ x: cx - spread, y: cy, id: 1 }, { x: cx + spread, y: cy, id: 2 }];
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(35) });
  for (const spread of [40, 50, 60, 70]) await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(spread) });
  await page.waitForFunction(() => {
    const level = Number.parseFloat(document.querySelector('[data-testid="realm-zoom-level"]').textContent);
    return level >= 190 && level <= 210;
  }, undefined, { timeout: 3000 });
  assert.ok(await zoom() >= 190 && await zoom() <= 210, 'Two fingers zoom the world around their midpoint.');
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const beforeTouchPan = await cameraTransform();
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 3 }] });
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + 65, y: cy + 20, id: 3 }] });
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(80); assert.notEqual(await cameraTransform(), beforeTouchPan);
  await touchSession.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await touchSession.detach();
  await page.getByRole('button', { name: 'Reset world view' }).click();
  const beforeReducedRelease = await count();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => !document.querySelector('[role="switch"][aria-label="Ambient fire animation"]'));
  await page.screenshot({ path: resolve(output, '06-hearth-phone.png') });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await count(), beforeReducedRelease);
  await page.evaluate(() => { window.__phase4.fixture.mode = 'normal'; });
  await page.getByRole('button', { name: 'Burn this letter', exact: true }).click();
  await page.getByText('A little lighter, now.', { exact: true }).waitFor({ timeout: 1500 });
  await page.waitForTimeout(200); const completedPhoneBox = await viewport.boundingBox();
  assert.ok(completedPhoneBox.y >= 0 && completedPhoneBox.y + completedPhoneBox.height <= 844, 'The confirmed ritual is brought into view on a phone.');
  assert.equal(await opacity('burn-envelope'), 0); assert.equal(await opacity('settled-ashes'), 1);
  await page.screenshot({ path: resolve(output, '09-finished-realm-phone.png') });
  await atHome(); assert.equal((await stored()).text, ''); assert.deepEqual(errors, []);
  console.log('Phase 4 browser checks passed: presets, safe release/recovery, zoom bounds, guardian/letter focus, mouse/wheel/keyboard/touch controls, ambient pause, progressive paper erosion, visible flames/ash, lingering completion, skip, phone layout/scroll, and reduced motion.');
} finally { await browser.close(); }
