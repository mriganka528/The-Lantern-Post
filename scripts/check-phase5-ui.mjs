// Real client components and Nest endpoints, with isolated test identities and
// an in-memory Prisma provider. No live account, database, or push service.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const clientRequire = createRequire(resolve(root, 'client/package.json'));
const webpack = require('webpack');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../.cache/art-tools/node_modules/playwright')); }
const { createFriendsTestApp } = require('../server/dist-test/test/friends-fixture.js');
const output = resolve(root, '.cache/phase5-review'); await mkdir(output, { recursive: true });
const entry = resolve(root, '.cache/phase5-ui-entry.tsx');
const loader = resolve(root, '.cache/phase5-tsx-loader.cjs');
await writeFile(loader, `const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;};`);
await writeFile(entry, `
import React, { useEffect, useMemo, useState } from 'react';
import { AppRegistry } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionDataProvider } from '../client/src/api/session-data-provider';
import { FriendsHall } from '../client/src/friends/friends-hall';
import { createFriendsTransport } from '../client/src/friends/friends-api';
import { useFriendsList, useFriendsSummary } from '../client/src/friends/use-friends-data';
import { PalaceHome } from '../client/src/storybook/palace-home';
import { NotificationSettings } from '../client/src/notifications/notification-settings';
const character = { id:'char_fox_lantern', key:'fox-lantern', displayName:'Ember', assetUrl:'bundled://characters/fox-lantern', title:'The keeper of little lights', description:'A warm-hearted wanderer.', palace: { theme:'amber-hollow', name:'The Amber Palace', description:'Honey-coloured windows, a crackling hearth, and a place for every little hope.' } };
function Account({ owner }) {
  const [screen, setScreen] = useState('friends');
  const getToken = useMemo(() => async () => owner, [owner]);
  const api = useMemo(() => createFriendsTransport(getToken), [getToken]);
  const ownerId = 'owner-' + owner;
  const summary = useFriendsSummary(api, ownerId); const list = useFriendsList(api, ownerId, 'friends');
  return screen === 'friends' ? <FriendsHall ownerId={ownerId} username={owner} api={api} onBack={() => setScreen('home')} notifications={<NotificationSettings ownerId={ownerId} getToken={getToken} />} /> : <PalaceHome character={character} username={owner} onCompanions={() => {}} onAccount={() => {}} onWrite={() => {}} onFriends={() => setScreen('friends')} friends={list.data?.pages.flatMap(page => page.items)} friendSummary={summary.data} />;
}
function Fixture() {
  const [owner, setOwner] = useState(new URLSearchParams(location.search).get('owner') || 'alice');
  useEffect(() => { window.__phase5 = { setOwner }; }, []);
  return <SafeAreaProvider><SessionDataProvider key={owner}><Account key={owner} owner={owner} /></SessionDataProvider></SafeAreaProvider>;
}
AppRegistry.registerComponent('Phase5Review', () => () => <React.StrictMode><Fixture /></React.StrictMode>);
AppRegistry.runApplication('Phase5Review', { rootTag: document.getElementById('root') });
`);
const compiler = webpack({ mode: 'development', devtool: false, target: 'web', entry, output: { path: output, filename: 'bundle.js' },
  resolve: { extensions: ['.web.tsx', '.tsx', '.web.ts', '.ts', '.web.js', '.js', '.mjs', '.json'], alias: { 'react-native$': clientRequire.resolve('react-native-web'), react: dirname(clientRequire.resolve('react/package.json')), 'react-dom': dirname(clientRequire.resolve('react-dom/package.json')) } },
  module: { rules: [{ test: /\.tsx?$/, use: loader }, { test: /\.(png|jpg)$/, type: 'asset/inline' }] },
  plugins: [new webpack.DefinePlugin({ __DEV__: 'true', 'process.env': JSON.stringify({ NODE_ENV: 'development', EXPO_OS: 'web', EXPO_PUBLIC_API_URL: 'https://api.example.invalid', EXPO_PUBLIC_WEB_API_URL: 'https://api.example.invalid', EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk' }), 'process.env.NODE_ENV': JSON.stringify('development') })], performance: { hints: false }, stats: 'errors-only',
});
await new Promise((done, fail) => compiler.run((error, stats) => { compiler.close(() => {}); if (error || stats.hasErrors()) fail(error || new Error(stats.toString('errors-only'))); else done(); }));
await writeFile(resolve(output, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;height:100%;width:100%}#root{display:flex}body{background:#F8F4EA}</style></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>');
console.log('Phase 5 browser fixture compiled.');
const backend = await createFriendsTestApp();
const browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome' });
const errors = [];
let holdReply = false; let releaseReply = () => {}; let loseSendReply = false; let failList = false;
try {
  async function createPage(owner, options = {}) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, ...options });
    page.on('pageerror', error => errors.push(error.message));
    await page.route(/^https?:\/\//, async route => {
      const original = new URL(route.request().url());
      if (original.origin !== 'https://api.example.invalid') return route.abort();
      if (failList && original.pathname === '/friends') return route.fulfill({ status: 503, contentType: 'application/json', body: '{}', headers: { 'Access-Control-Allow-Origin': '*' } });
      if (holdReply && original.pathname.endsWith('/respond')) await new Promise(resolve => { releaseReply = resolve; });
      const response = await route.fetch({ url: backend.url + original.pathname + original.search });
      if (loseSendReply && original.pathname === '/friends/requests' && route.request().method() === 'POST') { loseSendReply = false; return route.abort('failed'); }
      await route.fulfill({ response, headers: { ...response.headers(), 'Access-Control-Allow-Origin': '*' } });
    });
    await page.goto(pathToFileURL(resolve(output, 'index.html')).href + '?owner=' + owner);
    await page.getByRole('textbox', { name: "Friend's username" }).waitFor();
    return page;
  }
  const alice = await createPage('alice'); const bob = await createPage('bob');
  const input = page => page.getByRole('textbox', { name: "Friend's username" });
  async function search(page, name) { await input(page).fill(name); await page.getByRole('button', { name: 'Find their palace' }).click(); }
  await alice.getByText('Every friendship begins with a little hello.', { exact: true }).waitFor();
  await alice.screenshot({ path: resolve(output, '01-friendship-court-desktop.png') });
  await input(alice).fill('ab'); assert.equal(await alice.getByRole('button', { name: 'Find their palace' }).isDisabled(), true);
  await search(alice, '@BOB'); await alice.getByRole('button', { name: 'Invite bob', exact: true }).waitFor();
  await input(alice).fill('car'); assert.equal(await alice.getByRole('button', { name: 'Invite bob', exact: true }).count(), 0, 'Changing search hides stale results.');
  await search(alice, 'bob');
  backend.fixture.state.failJob = true;
  await alice.getByRole('button', { name: 'Invite bob', exact: true }).click();
  await alice.getByRole('button', { name: 'Refresh the guestbook' }).waitFor(); assert.equal(backend.fixture.state.requests.length, 0);
  backend.fixture.state.failJob = false;
  await alice.getByRole('button', { name: 'Refresh the guestbook' }).click();
  await alice.getByRole('button', { name: 'Invite bob', exact: true }).click();
  await alice.getByText('Your invitation is on its way to @bob.', { exact: true }).waitFor(); assert.equal(backend.fixture.state.requests.length, 1);
  assert.equal(await alice.getByRole('tab', { name: 'Sent invitations', exact: true }).getAttribute('aria-selected'), 'true');
  await bob.getByRole('button', { name: 'Refresh', exact: true }).click(); await bob.getByRole('tab', { name: 'At my gate', exact: true }).click();
  await bob.getByRole('button', { name: 'Welcome alice', exact: true }).waitFor();
  await bob.getByRole('button', { name: 'Decline invitation from alice', exact: true }).click();
  await bob.getByRole('button', { name: 'Keep invitation from alice', exact: true }).click(); assert.equal(backend.fixture.state.requests[0].status, 'PENDING');
  await bob.screenshot({ path: resolve(output, '02-sealed-invitation.png') });
  holdReply = true; await bob.getByRole('button', { name: 'Welcome alice', exact: true }).click();
  await bob.getByText('The palace post is carrying your reply…', { exact: true }).waitFor();
  assert.equal(await bob.getByTestId('friend-gate-reveal').count(), 0); assert.equal(backend.fixture.state.requests[0].status, 'PENDING');
  holdReply = false; releaseReply();
  await bob.getByText('A new gate opens.', { exact: true }).waitFor();
  await bob.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="friend-gate-left"]')).opacity === '0', undefined, { timeout: 5000 });
  await bob.screenshot({ path: resolve(output, '03-friendship-gate-opens.png') });
  assert.equal(backend.fixture.state.requests[0].status, 'ACCEPTED');
  await bob.getByRole('button', { name: 'Close dialog', exact: true }).last().click();
  await bob.getByRole('button', { name: "Open alice's friendship gate", exact: true }).waitFor();
  await bob.setViewportSize({ width: 390, height: 844 }); await bob.emulateMedia({ reducedMotion: 'reduce' });
  await bob.getByRole('button', { name: "Open alice's friendship gate", exact: true }).click();
  await bob.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="friend-gate-left"]')).opacity === '0', undefined, { timeout: 1200 });
  await bob.screenshot({ path: resolve(output, '06-open-gate-phone.png') });
  await bob.getByRole('button', { name: 'Close dialog', exact: true }).last().click();
  await alice.getByRole('button', { name: 'Refresh', exact: true }).click(); await alice.getByRole('tab', { name: 'Friendship gates', exact: true }).click();
  await alice.getByRole('button', { name: "Open bob's friendship gate", exact: true }).waitFor();
  // A lost reply is recovered from the real endpoint's persistent test state.
  loseSendReply = true; await search(alice, 'carol'); await alice.getByRole('button', { name: 'Invite carol', exact: true }).click();
  await alice.getByRole('button', { name: 'Refresh the guestbook' }).waitFor(); assert.equal(backend.fixture.state.requests.length, 2);
  await alice.reload(); await alice.getByRole('tab', { name: 'Sent invitations', exact: true }).click();
  await alice.getByText('Your invitation is waiting at their gate.', { exact: true }).waitFor();
  const carol = await createPage('carol', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await carol.getByRole('tab', { name: 'At my gate', exact: true }).click();
  await carol.getByRole('button', { name: 'Welcome alice', exact: true }).waitFor();
  await carol.screenshot({ path: resolve(output, '04-invitation-phone.png'), fullPage: false });
  assert.ok(await carol.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await carol.getByRole('button', { name: 'Decline invitation from alice', exact: true }).click();
  await carol.getByRole('button', { name: "Decline alice's invitation", exact: true }).click();
  await carol.getByText('The invitation has been quietly declined.', { exact: true }).waitFor();
  assert.equal(backend.fixture.state.requests.find(row => row.toUserId === 'owner-carol').status, 'DECLINED');
  // Switching account clears cached cards and pending searches.
  await alice.evaluate(() => window.__phase5.setOwner('carol'));
  await alice.getByText('Every friendship begins with a little hello.', { exact: true }).waitFor();
  assert.equal(await alice.getByRole('button', { name: "Open bob's friendship gate", exact: true }).count(), 0);
  assert.equal(await input(alice).inputValue(), ''); await alice.evaluate(() => window.__phase5.setOwner('alice'));
  await alice.getByRole('button', { name: "Open bob's friendship gate", exact: true }).waitFor();
  failList = true; await alice.getByRole('button', { name: 'Refresh', exact: true }).click();
  await alice.getByRole('button', { name: 'Try again', exact: true }).waitFor({ timeout: 6000 });
  failList = false; await alice.getByRole('button', { name: 'Try again', exact: true }).click(); await alice.getByRole('button', { name: "Open bob's friendship gate", exact: true }).waitFor();
  await alice.getByRole('button', { name: 'My palace', exact: true }).click();
  await alice.getByRole('button', { name: 'Skip to my palace', exact: true }).click();
  await alice.getByRole('button', { name: "Open bob's friendship gate", exact: true }).scrollIntoViewIfNeeded();
  await alice.screenshot({ path: resolve(output, '05-palace-friendship-gates.png') });
  assert.equal(await alice.getByTestId('river-current').count(), 1);
  await alice.getByRole('button', { name: "Open bob's friendship gate", exact: true }).click();
  await alice.getByText('The gate of bob', { exact: true }).waitFor();
  await alice.getByRole('button', { name: 'Close dialog', exact: true }).last().click();
  assert.deepEqual(errors, []);
  console.log('Phase 5 browser checks passed: search, stale-result hiding, real API send/accept/decline with test accounts, acknowledgement-before-gate, failure/reload recovery, account isolation, phone layout, and palace gates.');
} finally { await browser.close(); await backend.app.close(); }
