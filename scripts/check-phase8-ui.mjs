// Real components and Nest endpoints; only synthetic identities/content and
// isolated persistence/moderation providers are used. No live services.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)); const require = createRequire(import.meta.url); const clientRequire = createRequire(resolve(root, 'client/package.json'));
const webpack = require('webpack'); let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../.cache/art-tools/node_modules/playwright')); }
const { createFriendsTestApp } = require('../server/dist-test/test/friends-fixture.js');
const { serializePreset } = require('../server/dist-test/src/presets/preset.js'); const { serializeCharacter } = require('../server/dist-test/src/characters/catalog.js');
const backend = await createFriendsTestApp(false, { available: true, check: async () => 'APPROVED' });
backend.fixture.state.requests.push({ id: 'friendship_ab', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date(), respondedAt: new Date() });
const delivered = await fetch(backend.url + '/letters', { method: 'POST', headers: { Authorization: 'Bearer alice', 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID(), type: 'TEXT', destinationType: 'FRIEND', presetId: 'preset_lantern', recipientId: 'owner-bob', textContent: 'A synthetic letter for testing recipient reporting.', deliveryConfirmed: true }) }); assert.equal(delivered.status, 200);
const character = serializeCharacter(backend.fixture.state.users[0].character); const preset = serializePreset(backend.fixture.state.presets[0]);
const output = resolve(root, '.cache/phase8-review'); await mkdir(output, { recursive: true });
const entry = resolve(root, '.cache/phase8-ui-entry.tsx'); const loader = resolve(root, '.cache/phase8-tsx-loader.cjs');
await writeFile(loader, `const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;};`);
await writeFile(entry, `
import React, { useEffect, useMemo, useState } from 'react'; import { AppRegistry } from 'react-native'; import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionDataProvider } from '../client/src/api/session-data-provider'; import { WritingDesk } from '../client/src/letters/writing-desk'; import { PalaceLetterbox } from '../client/src/letters/letterbox'; import { PalaceHome } from '../client/src/storybook/palace-home';
import { createDeliveryTransport, createLetterBoxTransport } from '../client/src/letters/friend-letter-api'; import { createFriendsTransport } from '../client/src/friends/friends-api'; import { FriendsHall } from '../client/src/friends/friends-hall'; import { createSafetyTransport } from '../client/src/safety/safety-api';
const character = ${JSON.stringify(character)}; const presets = [${JSON.stringify(preset)}];
function Account({ owner }) { const [screen, setScreen] = useState(new URLSearchParams(location.search).get('screen') || 'home'); const ownerId = 'owner-' + owner; const token = useMemo(() => async () => owner, [owner]);
  const delivery = useMemo(() => createDeliveryTransport(token, ownerId), [token, ownerId]); const friends = useMemo(() => createFriendsTransport(token), [token]); const box = useMemo(() => createLetterBoxTransport(token), [token]); const safety = useMemo(() => createSafetyTransport(token), [token]);
  useEffect(() => { window.__phase8.setScreen = setScreen; }, []);
  return screen === 'writing' ? <WritingDesk key={owner} ownerId={ownerId} presets={presets} onRetryCatalog={() => {}} onBack={() => setScreen('home')} deliveryTransport={delivery} friendsTransport={friends} characterKey="fox-lantern" /> : screen === 'inbox' ? <PalaceLetterbox key={owner} ownerId={ownerId} api={box} safety={safety} onBack={() => setScreen('home')} onWrite={() => setScreen('writing')} /> : screen === 'friends' ? <FriendsHall key={owner} ownerId={ownerId} username={owner} api={friends} safety={safety} onBack={() => setScreen('home')} /> : <PalaceHome character={character} username={owner} onCompanions={() => {}} onAccount={() => {}} onWrite={() => setScreen('writing')} onFriends={() => setScreen('friends')} onInbox={() => setScreen('inbox')} />;
}
window.__phase8 = {};
function Fixture() { const [owner, setOwner] = useState(new URLSearchParams(location.search).get('owner') || 'alice'); useEffect(() => { window.__phase8.setOwner = setOwner; }, []); return <SafeAreaProvider><SessionDataProvider key={owner}><Account key={owner} owner={owner} /></SessionDataProvider></SafeAreaProvider>; }
AppRegistry.registerComponent('Phase8Review', () => () => <React.StrictMode><Fixture /></React.StrictMode>); AppRegistry.runApplication('Phase8Review', { rootTag: document.getElementById('root') });
`);
const compiler = webpack({ mode: 'development', devtool: false, target: 'web', entry, output: { path: output, filename: 'bundle.js' }, resolve: { extensions: ['.web.tsx', '.tsx', '.web.ts', '.ts', '.web.js', '.js', '.mjs', '.json'], alias: { 'react-native$': clientRequire.resolve('react-native-web'), react: dirname(clientRequire.resolve('react/package.json')), 'react-dom': dirname(clientRequire.resolve('react-dom/package.json')) } }, module: { rules: [{ test: /\.tsx?$/, use: loader }, { test: /\.(png|jpg)$/, type: 'asset/inline' }] }, plugins: [new webpack.DefinePlugin({ __DEV__: 'true', 'process.env': JSON.stringify({ NODE_ENV: 'development', EXPO_OS: 'web', EXPO_PUBLIC_API_URL: 'https://api.example.invalid', EXPO_PUBLIC_WEB_API_URL: 'https://api.example.invalid', EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk' }), 'process.env.NODE_ENV': JSON.stringify('development') })], performance: { hints: false }, stats: 'errors-only' });
let browser;
try {
  await new Promise((done, fail) => compiler.run((error, stats) => { compiler.close(() => {}); if (error || stats.hasErrors()) fail(error || new Error(stats.toString('errors-only'))); else done(); }));
  await writeFile(resolve(output, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;height:100%;width:100%}#root{display:flex}body{background:#F8F4EA}</style></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>'); console.log('Phase 8 browser fixture compiled.');
  browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome' }); const errors = []; const requests = []; let holdBlock = false; let releaseBlock = () => {}; let loseReport = false;
  async function pageFor(owner, screen = 'home') {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\//, async route => {
      const url = new URL(route.request().url()); if (url.origin !== 'https://api.example.invalid') return route.abort(); requests.push({ path: url.pathname, method: route.request().method() });
      if (holdBlock && url.pathname === '/safety/blocks/owner-bob') await new Promise(resolve => { releaseBlock = resolve; });
      const response = await route.fetch({ url: backend.url + url.pathname + url.search });
      if (loseReport && url.pathname.endsWith('/report')) { loseReport = false; return route.abort('failed'); }
      return route.fulfill({ response, headers: { ...response.headers(), 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto(pathToFileURL(resolve(output, 'index.html')).href + '?owner=' + owner + '&screen=' + screen); return page;
  }
  const alice = await pageFor('alice'); await alice.getByRole('button', { name: 'Skip to my palace', exact: true }).click(); await alice.getByTestId('flying-dove-0').waitFor();
  const readMotion = () => alice.evaluate(() => ['river-current', 'waterfall-204', 'flying-dove-0'].map(id => getComputedStyle(document.querySelector('[data-testid="' + id + '"]')).transform));
  const initial = await readMotion(); await alice.waitForTimeout(350); const moving = await readMotion(); moving.forEach((value, i) => assert.notEqual(value, initial[i]));
  const switcher = alice.getByRole('switch', { name: 'Ambient palace animation' }); await switcher.click(); await alice.waitForTimeout(80); const paused = await readMotion(); await alice.waitForTimeout(350); assert.deepEqual(await readMotion(), paused); await switcher.click();
  await alice.screenshot({ path: resolve(output, '01-living-palace-and-doves.png') });
  await alice.getByRole('button', { name: /Open the writing desk/ }).click(); await alice.getByRole('textbox', { name: 'Your letter' }).fill('A little starlight, saved for another day.');
  const postsBeforeSeal = requests.filter(x => x.method === 'POST').length;
  await alice.getByRole('button', { name: 'Seal my letter', exact: true }).click(); await alice.getByTestId('sealing-court').waitFor(); await alice.waitForTimeout(650);
  await alice.getByTestId('sealing-court').screenshot({ path: resolve(output, '02-celestial-sealing-ritual.png') });
  const skip = alice.getByRole('button', { name: 'Skip sealing animation', exact: true }); if (await skip.count()) await skip.click();
  await alice.getByRole('button', { name: 'Open my letter again', exact: true }).waitFor(); assert.equal(requests.filter(x => x.method === 'POST').length, postsBeforeSeal);
  assert.equal(await alice.getByTestId('envelope-wax').evaluate(e => getComputedStyle(e).opacity), '1');
  await alice.getByTestId('sealing-court').screenshot({ path: resolve(output, '03-celestial-sealed-envelope.png') });
  await alice.setViewportSize({ width: 390, height: 844 }); await alice.getByTestId('sealing-court').screenshot({ path: resolve(output, '04-sealing-court-phone.png') }); assert.ok(await alice.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await alice.emulateMedia({ reducedMotion: 'reduce' }); await alice.getByRole('button', { name: 'Open my letter again', exact: true }).click(); await alice.getByRole('button', { name: 'Seal my letter', exact: true }).click(); await alice.getByRole('button', { name: 'Open my letter again', exact: true }).waitFor(); assert.equal(await skip.count(), 0);
  const stationary = await alice.getByTestId('flying-dove-0').evaluate(e => getComputedStyle(e).transform); await alice.waitForTimeout(200); assert.equal(await alice.getByTestId('flying-dove-0').evaluate(e => getComputedStyle(e).transform), stationary);
  await alice.getByRole('button', { name: 'Return to my palace', exact: true }).click(); await alice.evaluate(() => window.__phase8.setScreen('friends'));
  await alice.getByRole('button', { name: "Open bob's friendship gate", exact: true }).click(); await alice.getByRole('button', { name: 'Block bob', exact: true }).click();
  await alice.getByRole('button', { name: 'Keep things as they are', exact: true }).click(); assert.equal(backend.fixture.state.blocks.length, 0);
  await alice.getByRole('button', { name: "Open bob's friendship gate", exact: true }).click(); await alice.getByRole('button', { name: 'Block bob', exact: true }).click();
  holdBlock = true; await alice.getByRole('button', { name: 'Block bob', exact: true }).click(); await alice.getByRole('button', { name: 'Saving your choice…', exact: true }).waitFor(); assert.equal(backend.fixture.state.blocks.length, 0);
  holdBlock = false; releaseBlock(); await alice.getByText('The gate has been closed. You can manage it in My closed gates.', { exact: true }).waitFor(); assert.equal(backend.fixture.state.blocks.length, 1);
  assert.equal(await alice.getByRole('button', { name: "Open bob's friendship gate", exact: true }).count(), 0);
  await alice.getByRole('button', { name: 'My closed gates', exact: true }).click(); await alice.getByRole('button', { name: 'Unblock bob', exact: true }).waitFor();
  await alice.screenshot({ path: resolve(output, '05-closed-gates-phone.png') });
  await alice.getByRole('button', { name: 'Unblock bob', exact: true }).click(); await alice.getByRole('dialog').getByRole('button', { name: 'Unblock bob', exact: true }).click(); await alice.getByText('You haven’t blocked any palaces.', { exact: true }).waitFor(); assert.equal(backend.fixture.state.requests[0].status, 'DECLINED');
  await alice.getByRole('textbox', { name: "Friend's username", exact: true }).fill('bob'); await alice.getByRole('button', { name: 'Find their palace', exact: true }).click(); await alice.getByRole('button', { name: 'Invite bob', exact: true }).click(); assert.equal(backend.fixture.state.requests[0].status, 'PENDING');
  const bob = await pageFor('bob', 'friends'); await bob.emulateMedia({ reducedMotion: 'reduce' }); await bob.getByRole('tab', { name: 'At my gate', exact: true }).click(); await bob.getByRole('button', { name: 'Welcome alice', exact: true }).click(); await bob.getByText('A new gate opens.', { exact: true }).waitFor(); await bob.getByRole('button', { name: 'Close dialog', exact: true }).last().click();
  await bob.evaluate(() => window.__phase8.setScreen('inbox')); await bob.getByRole('button', { name: 'Open letter from alice, unopened', exact: true }).click(); await bob.getByRole('button', { name: 'Break the seal', exact: true }).click();
  await bob.getByRole('button', { name: 'Report this letter', exact: true }).click(); await bob.getByRole('radio', { name: 'Harassment or bullying', exact: true }).click(); await bob.getByRole('textbox', { name: 'Report details, optional', exact: true }).fill('A synthetic report from the browser fixture.'); await bob.getByRole('checkbox', { name: 'Also block alice', exact: true }).click();
  await bob.setViewportSize({ width: 390, height: 844 }); await bob.screenshot({ path: resolve(output, '06-report-letter-phone.png') });
  loseReport = true; await bob.getByRole('button', { name: 'Save report and block sender', exact: true }).click(); await bob.getByText('We could not connect. Check your connection and try again.', { exact: true }).waitFor(); assert.equal(backend.fixture.state.reports.length, 1);
  await bob.getByRole('button', { name: 'Save report and block sender', exact: true }).click(); await bob.getByText('Your report has been saved.', { exact: true }).waitFor(); assert.equal(backend.fixture.state.reports.length, 1);
  await bob.getByRole('button', { name: 'Return to my letters', exact: true }).click(); await bob.getByText('The post is quiet, for now.', { exact: true }).waitFor(); assert.equal(backend.fixture.state.blocks[0].blockerId, 'owner-bob');
  await bob.evaluate(() => window.__phase8.setOwner('carol')); await bob.evaluate(() => window.__phase8.setScreen('friends')); await bob.getByRole('button', { name: 'My closed gates', exact: true }).click(); await bob.getByText('You haven’t blocked any palaces.', { exact: true }).waitFor(); assert.equal(await bob.getByRole('button', { name: 'Unblock alice', exact: true }).count(), 0);
  assert.deepEqual(errors, []); console.log('Phase 8 browser checks passed: faster living scenery/doves, pause/reduced motion, ornate sealing/skip/no-send, responsive layouts, confirmed blocking, unblocking without friendship, acceptance, reporting/lost-reply retry and account isolation.');
} finally { if (browser) await browser.close(); await backend.app.close(); }
