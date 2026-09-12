// Actual client components and Nest endpoints. Test identities, persistence
// and moderation are isolated providers; no live letter is sent or approved.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url); const clientRequire = createRequire(resolve(root, 'client/package.json'));
const webpack = require('webpack');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../.cache/art-tools/node_modules/playwright')); }
const { createFriendsTestApp } = require('../server/dist-test/test/friends-fixture.js');
const { serializePreset } = require('../server/dist-test/src/presets/preset.js');
const { serializeCharacter } = require('../server/dist-test/src/characters/catalog.js');
const { ServiceUnavailableException } = require('@nestjs/common');
let available = false; let mode = 'approved'; let release = () => {}; let checks = 0;
const backend = await createFriendsTestApp(false, { get available() { return available; }, check: async () => {
  checks++; if (mode === 'hold') await new Promise(resolve => { release = resolve; });
  if (mode === 'unavailable') throw new ServiceUnavailableException({ code: 'MODERATION_UNAVAILABLE' });
  return mode === 'rejected' ? 'REJECTED' : 'APPROVED';
} });
backend.fixture.state.requests.push({ id: 'friendship_ab', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date(), respondedAt: new Date() });
backend.fixture.state.users[1].character = { id: 'char_rabbit_moon', key: 'rabbit-moon', displayName: 'Lune', assetUrl: 'bundled://characters/rabbit-moon' }; backend.fixture.state.users[1].characterId = 'char_rabbit_moon';
const character = serializeCharacter(backend.fixture.state.users[0].character);
const preset = serializePreset(backend.fixture.state.presets[0]);
const output = resolve(root, '.cache/phase6-review'); await mkdir(output, { recursive: true });
const entry = resolve(root, '.cache/phase6-ui-entry.tsx'); const loader = resolve(root, '.cache/phase6-tsx-loader.cjs');
await writeFile(loader, `const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;};`);
await writeFile(entry, `
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppRegistry } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionDataProvider } from '../client/src/api/session-data-provider';
import { WritingDesk } from '../client/src/letters/writing-desk';
import { PalaceLetterbox } from '../client/src/letters/letterbox';
import { createDeliveryTransport, createLetterBoxTransport } from '../client/src/letters/friend-letter-api';
import { createFriendsTransport } from '../client/src/friends/friends-api';
import { PalaceHome } from '../client/src/storybook/palace-home';
import { useLetterboxSummary } from '../client/src/letters/use-letterbox';
const presets = [${JSON.stringify(preset)}]; const character = ${JSON.stringify(character)};
function Account({ owner }) {
  const [screen, setScreen] = useState(new URLSearchParams(location.search).get('screen') || 'writing');
  const getToken = useMemo(() => async () => owner, [owner]);
  const delivery = useMemo(() => createDeliveryTransport(getToken), [getToken]);
  const friends = useMemo(() => createFriendsTransport(getToken), [getToken]);
  const box = useMemo(() => createLetterBoxTransport(getToken), [getToken]);
  const summary = useLetterboxSummary(box, 'owner-' + owner);
  const back = useCallback(() => setScreen('home'), []);
  useEffect(() => { window.__phase6.screen = screen; }, [screen]);
  return screen === 'writing' ? <WritingDesk key={owner} ownerId={'owner-' + owner} presets={presets} onRetryCatalog={() => {}} onBack={back} deliveryTransport={delivery} friendsTransport={friends} characterKey="fox-lantern" /> : screen === 'inbox' ? <PalaceLetterbox ownerId={'owner-' + owner} api={box} onBack={back} onWrite={() => setScreen('writing')} onReply={() => setScreen('writing')} /> : <PalaceHome character={character} username={owner} onCompanions={() => {}} onAccount={() => {}} onWrite={() => setScreen('writing')} onFriends={() => {}} onInbox={() => setScreen('inbox')} unreadLetters={summary.data?.unread} />;
}
function Fixture() {
  const [owner, setOwner] = useState(new URLSearchParams(location.search).get('owner') || 'alice');
  useEffect(() => { window.__phase6 = { setOwner }; }, []);
  return <SafeAreaProvider><SessionDataProvider key={owner}><Account key={owner} owner={owner} /></SessionDataProvider></SafeAreaProvider>;
}
AppRegistry.registerComponent('Phase6Review', () => () => <React.StrictMode><Fixture /></React.StrictMode>);
AppRegistry.runApplication('Phase6Review', { rootTag: document.getElementById('root') });
`);
const compiler = webpack({ mode: 'development', devtool: false, target: 'web', entry, output: { path: output, filename: 'bundle.js' },
  resolve: { extensions: ['.web.tsx', '.tsx', '.web.ts', '.ts', '.web.js', '.js', '.mjs', '.json'], alias: { 'react-native$': clientRequire.resolve('react-native-web'), react: dirname(clientRequire.resolve('react/package.json')), 'react-dom': dirname(clientRequire.resolve('react-dom/package.json')) } },
  module: { rules: [{ test: /\.tsx?$/, use: loader }, { test: /\.(png|jpg)$/, type: 'asset/inline' }] },
  plugins: [new webpack.DefinePlugin({ __DEV__: 'true', 'process.env': JSON.stringify({ NODE_ENV: 'development', EXPO_OS: 'web', EXPO_PUBLIC_API_URL: 'https://api.example.invalid', EXPO_PUBLIC_WEB_API_URL: 'https://api.example.invalid', EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk' }), 'process.env.NODE_ENV': JSON.stringify('development') })], performance: { hints: false }, stats: 'errors-only',
});
let browser;
try {
  await new Promise((done, fail) => compiler.run((error, stats) => { compiler.close(() => {}); if (error || stats.hasErrors()) fail(error || new Error(stats.toString('errors-only'))); else done(); }));
  await writeFile(resolve(output, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;height:100%;width:100%}#root{display:flex}body{background:#F8F4EA}</style></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>');
  console.log('Phase 6 browser fixture compiled.');
  browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome' });
  const errors = []; const requests = []; let loseReply = false;
  async function pageFor(owner, screen = 'writing') {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\//, async route => {
      const original = new URL(route.request().url()); if (original.origin !== 'https://api.example.invalid') return route.abort();
      requests.push({ owner, path: original.pathname, method: route.request().method() });
      const response = await route.fetch({ url: backend.url + original.pathname + original.search });
      if (loseReply && original.pathname === '/letters' && route.request().method() === 'POST') { loseReply = false; return route.abort('failed'); }
      await route.fulfill({ response, headers: { ...response.headers(), 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto(pathToFileURL(resolve(output, 'index.html')).href + '?owner=' + owner + '&screen=' + screen);
    return page;
  }
  const alice = await pageFor('alice'); const bob = await pageFor('bob', 'inbox');
  await alice.bringToFront();
  const words = 'Dear Lune,\n\nThe moonflowers are blooming again. I saved a little light from the garden for you.\n\nWith warmth,\nEmber';
  const storage = () => alice.evaluate(() => JSON.parse(localStorage.getItem('lantern-draft-v1-owner-alice')));
  async function chooseGate() {
    await alice.getByRole('button', { name: "Send to a friend's gate", exact: true }).click();
    await alice.getByRole('radio', { name: 'Send to bob', exact: true }).click();
  }
  async function seal(text = words) {
    await alice.getByRole('textbox', { name: 'Your letter' }).fill(text); await alice.getByRole('button', { name: 'Seal my letter', exact: true }).click();
    const skip = alice.getByRole('button', { name: 'Skip sealing animation', exact: true }); if (await skip.count()) await skip.click();
    await chooseGate();
  }
  async function home() {
    await alice.waitForFunction(() => window.__phase6.screen === 'home');
    const skip = alice.getByRole('button', { name: 'Skip to my palace', exact: true }); if (await skip.count()) await skip.click();
  }
  async function newLetter(text) { await alice.bringToFront(); await alice.getByRole('button', { name: /Open the writing desk/ }).click(); assert.equal(await alice.getByRole('textbox', { name: 'Your letter' }).inputValue(), ''); await seal(text); }
  await seal(); await alice.getByText('Delivery is resting for now.', { exact: false }).waitFor();
  assert.equal(await alice.getByRole('button', { name: 'Send my letter to bob', exact: true }).isDisabled(), true);
  await alice.getByRole('button', { name: 'Preview the journey', exact: true }).click(); await alice.getByTestId('delivery-journey').waitFor();
  const before = await alice.getByTestId('delivery-courier').evaluate(e => getComputedStyle(e).transform); await alice.waitForTimeout(2400);
  assert.notEqual(await alice.getByTestId('delivery-courier').evaluate(e => getComputedStyle(e).transform), before);
  await alice.getByTestId('delivery-journey').screenshot({ path: resolve(output, '01-preview-journey.png') });
  assert.equal(backend.fixture.state.letters.length, 0); assert.equal((await storage()).stage, 'sealed'); assert.equal((await storage()).text, words);
  assert.equal(requests.filter(r => r.path === '/letters').length, 0, 'Preview must not send a letter.');
  await alice.getByRole('button', { name: 'Return to my sealed letter', exact: true }).click();
  await alice.getByRole('button', { name: 'Keep my sealed letter', exact: true }).click();
  available = true; await chooseGate();
  await alice.getByRole('button', { name: 'Send my letter to bob', exact: true }).waitFor();
  mode = 'hold'; await alice.getByRole('button', { name: 'Send my letter to bob', exact: true }).click();
  await alice.getByText('Waiting for the palace post…', { exact: true }).waitFor();
  while (!checks) await alice.waitForTimeout(10);
  assert.equal((await storage()).stage, 'delivery-pending'); assert.equal(backend.fixture.state.letters.length, 0); assert.equal(await alice.getByTestId('delivery-journey').count(), 0);
  mode = 'approved'; release(); await alice.getByTestId('delivery-journey').waitFor(); assert.equal((await storage()).text, '');
  await alice.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="delivery-gate-left"]')).opacity === '0', undefined, { timeout: 10000 });
  await alice.getByTestId('delivery-journey').screenshot({ path: resolve(output, '02-delivered-at-the-gate.png') });
  await alice.getByRole('button', { name: 'Return to my palace', exact: true }).click(); await home(); assert.equal((await storage()).stage, 'writing');
  await bob.bringToFront(); await bob.getByRole('button', { name: 'Refresh letterbox', exact: true }).click();
  await bob.getByRole('button', { name: 'Open letter from alice, unopened', exact: true }).waitFor();
  await bob.screenshot({ path: resolve(output, '03-private-letterbox.png') });
  const beforeOpen = requests.filter(r => r.path.endsWith('/open')).length;
  await bob.getByRole('button', { name: 'Open letter from alice, unopened', exact: true }).click(); assert.equal(requests.filter(r => r.path.endsWith('/open')).length, beforeOpen);
  await bob.getByRole('button', { name: 'Break the seal', exact: true }).click(); await bob.getByText(words, { exact: true }).waitFor(); assert.ok(backend.fixture.state.letters[0].readAt);
  await bob.getByTestId('opened-friend-letter').screenshot({ path: resolve(output, '04-opened-vintage-letter.png') });
  await bob.getByRole('button', { name: 'Remove this letter', exact: true }).click(); await bob.getByRole('button', { name: 'Keep this letter', exact: true }).click(); assert.equal(backend.fixture.state.letters[0].status, 'DELIVERED');
  await bob.getByRole('button', { name: 'Remove this letter', exact: true }).click(); await bob.getByRole('button', { name: 'Remove from both palaces', exact: true }).click();
  await bob.getByText('The post is quiet, for now.', { exact: true }).waitFor(); assert.equal(backend.fixture.state.letters[0].textContent, null);
  // Lost acknowledgement and reload recover from a receipt without a second send.
  await newLetter('A second little light, safe after an interrupted reply.'); loseReply = true;
  const beforeSend = requests.filter(r => r.path === '/letters').length;
  await alice.getByRole('button', { name: 'Send my letter to bob', exact: true }).click(); await alice.getByRole('button', { name: 'Retry this delivery', exact: true }).waitFor();
  assert.equal((await storage()).stage, 'delivery-pending'); await alice.reload(); await alice.getByRole('button', { name: 'Skip delivery animation', exact: true }).click(); await home();
  assert.equal(requests.filter(r => r.path === '/letters').length, beforeSend + 1); assert.equal((await storage()).text, '');
  await bob.bringToFront(); await bob.setViewportSize({ width: 390, height: 844 }); await bob.emulateMedia({ reducedMotion: 'reduce' }); await bob.getByRole('button', { name: 'Refresh letterbox', exact: true }).click();
  await bob.getByRole('button', { name: 'Open letter from alice, unopened', exact: true }).click(); await bob.getByRole('button', { name: 'Break the seal', exact: true }).click(); await bob.getByText('A second little light, safe after an interrupted reply.', { exact: true }).waitFor();
  await bob.screenshot({ path: resolve(output, '05-letter-reader-phone.png') }); assert.ok(await bob.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  // A check outage can be durably cancelled without losing the sealed words.
  await newLetter('These words should stay with me after cancellation.'); mode = 'unavailable'; const lettersBeforeCancel = backend.fixture.state.letters.length;
  await alice.getByRole('button', { name: 'Send my letter to bob', exact: true }).click(); await alice.getByRole('button', { name: 'Cancel delivery and keep my letter', exact: true }).click();
  await alice.getByText('The delivery was cancelled. Your sealed letter is still here with you.', { exact: true }).waitFor(); assert.equal((await storage()).stage, 'sealed'); assert.equal(backend.fixture.state.letters.length, lettersBeforeCancel);
  await alice.getByRole('button', { name: 'Open my letter again', exact: true }).click(); assert.equal(await alice.getByRole('textbox', { name: 'Your letter' }).inputValue(), 'These words should stay with me after cancellation.');
  // The old account's late response cannot overwrite the new account's page.
  await seal('A delivery owned by the first account.'); mode = 'hold'; const previousChecks = checks;
  await alice.getByRole('button', { name: 'Send my letter to bob', exact: true }).click(); while (checks === previousChecks) await alice.waitForTimeout(10);
  await alice.evaluate(() => window.__phase6.setOwner('carol')); await alice.getByRole('textbox', { name: 'Your letter' }).fill('A private draft belonging only to Carol.'); mode = 'approved'; release();
  await alice.waitForFunction(() => JSON.parse(localStorage.getItem('lantern-draft-v1-owner-alice')).stage === 'delivered');
  assert.equal(await alice.getByRole('textbox', { name: 'Your letter' }).inputValue(), 'A private draft belonging only to Carol.');
  assert.deepEqual(errors, []);
  console.log('Phase 6 browser checks passed: zero-send preview, walking courier, confirmed delivery, local cleanup, private reading/deletion, lost reply/reload, durable cancellation, account isolation, and phone/reduced-motion layout.');
} finally { if (browser) await browser.close(); await backend.app.close(); }
