// Offline interaction review of the actual components and browser draft storage.
// Builds a file:// fixture; no preview server, Clerk session, or real account is used.
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
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('../.cache/art-tools/node_modules/playwright')); }
const { serializeCharacter } = require('../server/dist-test/src/characters/catalog.js');
const { serializePreset } = require('../server/dist-test/src/presets/preset.js');
const characterSql = await readFile(resolve(root, 'server/prisma/migrations/20260912010000_seed_characters/migration.sql'), 'utf8');
const presetSql = await readFile(resolve(root, 'server/prisma/migrations/20260912020000_seed_stationery/migration.sql'), 'utf8');
const characters = [...characterSql.matchAll(/\('([^']+)', '([^']+)', '([^']+)', '([^']+)'/g)].map(([, id, key, displayName, assetUrl]) => serializeCharacter({ id, key, displayName, assetUrl }));
const presets = [...presetSql.matchAll(/\('([^']+)', '([^']+)', '([^']+)', '(\{[^']+\})'::jsonb/g)].map(([, id, key, displayName, json]) => serializePreset({ id, key, displayName, configJson: JSON.parse(json) }));
assert.equal(characters.length, 6); assert.equal(presets.length, 6); assert.ok(presets.every(Boolean));
const output = resolve(root, '.cache/phase3-review');
await mkdir(output, { recursive: true });
const entry = resolve(root, '.cache/phase3-ui-entry.tsx');
const loader = resolve(root, '.cache/phase3-tsx-loader.cjs');
await writeFile(loader, `const ts = require('typescript'); module.exports = function(source) { return ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText; };`);
await writeFile(entry, `
import React, { useEffect, useState } from 'react';
import { AppRegistry, View, Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CharacterGallery } from '../client/src/storybook/character-gallery';
import { PalaceHome } from '../client/src/storybook/palace-home';
import { StoryDialog, s } from '../client/src/storybook/story-ui';
import { WritingDesk } from '../client/src/letters/writing-desk';
const characters = ${JSON.stringify(characters)};
const presets = ${JSON.stringify(presets)};
function Fixture() {
  const [screen, setScreen] = useState(localStorage.getItem('phase3-fixture-screen') || 'home');
  const [owner, setOwner] = useState('review-a');
  const [character, setCharacter] = useState(characters[0]);
  const [account, setAccount] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { localStorage.setItem('phase3-fixture-screen', screen); }, [screen]);
  useEffect(() => { window.__phase3 = { setOwner, setScreen, setUnavailable }; }, []);
  return <SafeAreaProvider><View style={{flex:1}}>
    {screen === 'home' && <PalaceHome key={character.id} character={character} username="starlit_soul" onCompanions={() => setScreen('gallery')} onAccount={() => setAccount(true)} onWrite={() => setScreen('writing')} />}
    {screen === 'gallery' && <CharacterGallery characters={characters} currentId={character.id} busy={false} onAccount={() => setAccount(true)} onBack={() => setScreen('home')} onChoose={c => { setCharacter(c); setScreen('home'); }} />}
    {screen === 'writing' && <WritingDesk key={owner} ownerId={owner} presets={unavailable ? [] : presets} catalogUnavailable={unavailable} onRetryCatalog={() => setUnavailable(false)} onBack={() => setScreen('home')} />}
    {account && <StoryDialog title="Your little corner" onClose={() => setAccount(false)}><Text style={s.body}>Local review fixture</Text></StoryDialog>}
  </View></SafeAreaProvider>;
}
AppRegistry.registerComponent('Phase3Review', () => () => <React.StrictMode><Fixture /></React.StrictMode>);
AppRegistry.runApplication('Phase3Review', { rootTag: document.getElementById('root') });
`);
const compiler = webpack({
  mode: 'development', devtool: false, target: 'web', entry,
  output: { path: output, filename: 'bundle.js' },
  resolve: { extensions: ['.web.tsx', '.tsx', '.web.ts', '.ts', '.web.js', '.js', '.mjs', '.json'], alias: {
    'react-native$': clientRequire.resolve('react-native-web'),
    react: dirname(clientRequire.resolve('react/package.json')),
    'react-dom': dirname(clientRequire.resolve('react-dom/package.json')),
  } },
  module: { rules: [{ test: /\.tsx?$/, use: loader }, { test: /\.(png|jpg)$/, type: 'asset/inline' }] },
  plugins: [new webpack.DefinePlugin({ __DEV__: 'true', 'process.env': JSON.stringify({ NODE_ENV: 'development', EXPO_OS: 'web' }), 'process.env.NODE_ENV': JSON.stringify('development') })],
  performance: { hints: false }, stats: 'errors-only',
});
await new Promise((resolve, reject) => compiler.run((error, stats) => {
  compiler.close(() => {});
  if (error || stats.hasErrors()) reject(error || new Error(stats.toString('errors-only')));
  else resolve();
}));
await writeFile(resolve(output, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;height:100%;width:100%}#root{display:flex}body{background:#F8F4EA}</style></head><body><div id="root"></div><script src="./bundle.js"></script></body></html>');
console.log('Offline browser fixture compiled; starting interaction checks.');
const browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  await page.route(/^https?:\/\//, route => route.abort());
  await page.goto(pathToFileURL(resolve(output, 'index.html')).href);
  await page.getByRole('button', { name: 'Open the doors', exact: true }).click();
  await page.getByRole('button', { name: 'Skip the walk' }).waitFor({ timeout: 6000 });
  const actor = page.getByTestId('palace-companion-path');
  const start = await actor.boundingBox();
  const firstStep = await page.getByTestId('companion-left-step').evaluate(element => getComputedStyle(element).transform);
  await page.waitForTimeout(650);
  await page.screenshot({ path: resolve(output, '01-walking-to-the-palace.png') });
  const middle = await actor.boundingBox();
  assert.ok(middle.y < start.y && middle.width < start.width, 'Companion must move toward the palace and recede');
  assert.notEqual(await page.getByTestId('companion-left-step').evaluate(element => getComputedStyle(element).transform), firstStep, 'The companion must take visible steps');
  await page.getByRole('button', { name: 'Skip the walk' }).waitFor({ state: 'hidden', timeout: 5000 });
  await page.screenshot({ path: resolve(output, '02-majestic-palace.png') });
  const fall = page.getByTestId('waterfall-204');
  const waterA = await fall.evaluate(element => getComputedStyle(element).transform);
  await page.waitForTimeout(300);
  assert.notEqual(await fall.evaluate(element => getComputedStyle(element).transform), waterA, 'Waterfall should flow');
  await page.getByRole('switch', { name: 'Ambient palace animation' }).click();
  await page.waitForTimeout(80);
  const paused = await fall.evaluate(element => getComputedStyle(element).transform);
  await page.waitForTimeout(250);
  assert.equal(await fall.evaluate(element => getComputedStyle(element).transform), paused, 'Ambient pause should stop water');
  await page.getByRole('button', { name: /Open the writing desk/ }).click();
  const letter = page.getByRole('textbox', { name: 'Your letter' });
  await letter.waitFor();
  assert.equal(await page.getByRole('radio').count(), 6);
  assert.ok(await page.getByRole('button', { name: 'Seal my letter' }).isDisabled());
  const text = 'Dear little world,\n\nToday I found a little courage in the quiet. I want to remember the way the light fell on the river, and how it felt to begin again.\n\nWith a little hope, always.';
  await letter.fill(text);
  for (const preset of presets) {
    const choice = page.getByRole('radio', { name: preset.displayName, exact: true });
    await choice.click();
    assert.equal(await choice.getAttribute('aria-checked'), 'true');
  }
  await page.getByRole('radio', { name: 'Royal ivory', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('radio', { name: 'Lantern parchment', exact: true }).getAttribute('aria-checked'), 'true');
  await page.getByRole('radio', { name: 'Rose & ribbon', exact: true }).click();
  await page.screenshot({ path: resolve(output, '03-writing-desk.png') });
  await page.reload();
  await letter.waitFor();
  assert.equal(await letter.inputValue(), text);
  assert.equal(await page.getByRole('radio', { name: 'Rose & ribbon', exact: true }).getAttribute('aria-checked'), 'true');
  await letter.fill('💛'.repeat(2001));
  assert.ok(await page.getByRole('button', { name: 'Seal my letter' }).isDisabled());
  await page.getByText('Your letter is 1 character over the limit.', { exact: true }).waitFor();
  await letter.fill(text);
  await page.getByRole('button', { name: 'Seal my letter' }).click();
  await page.getByRole('button', { name: 'Skip sealing animation' }).waitFor();
  await page.waitForTimeout(550);
  await page.screenshot({ path: resolve(output, '04-folding-the-letter.png') });
  await page.getByRole('button', { name: 'Open my letter again' }).waitFor({ timeout: 5000 });
  await page.screenshot({ path: resolve(output, '05-sealed-envelope.png') });
  await page.reload();
  await page.getByRole('button', { name: 'Open my letter again' }).click();
  assert.equal(await letter.inputValue(), text);
  await page.evaluate(() => window.__phase3.setOwner('review-b'));
  await letter.waitFor();
  assert.equal(await letter.inputValue(), '', 'Another owner must not see the first draft');
  await page.evaluate(() => window.__phase3.setOwner('review-a'));
  await letter.waitFor();
  assert.equal(await letter.inputValue(), text);
  await page.evaluate(() => window.__phase3.setUnavailable(true));
  await letter.fill(text + '\nEven when the clouds roll in.');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, '06-writing-desk-phone.png') });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Phone editor must fit');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Seal my letter' }).click();
  await page.getByRole('button', { name: 'Open my letter again' }).waitFor({ timeout: 1000 });
  await page.screenshot({ path: resolve(output, '07-sealed-envelope-phone.png') });
  await page.getByRole('button', { name: 'Return to my palace' }).click();
  await page.getByRole('button', { name: 'Open the doors', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Skip the walk' }).count(), 0);
  await page.screenshot({ path: resolve(output, '08-majestic-palace-phone.png') });
  assert.deepEqual(errors, []);
  console.log('Phase 3 browser checks passed: walking arrival, moving/paused water, six stationery styles, local restore, owner isolation, length limit, sealing/reopening, phone layout, and reduced motion.');
} finally { await browser.close(); }
