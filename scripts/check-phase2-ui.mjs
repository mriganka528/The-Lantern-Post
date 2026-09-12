// Exercises the real presentation components with a local fixture, outside Expo Router.
// This does not bypass application auth or claim to verify a live Clerk session.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require('../.cache/art-tools/node_modules/playwright')); }
const { serializeCharacter } = require('../server/dist-test/src/characters/catalog.js');
const sql = await readFile(resolve(root, 'server/prisma/migrations/20260912010000_seed_characters/migration.sql'), 'utf8');
const characters = [...sql.matchAll(/\('([^']+)', '([^']+)', '([^']+)', '([^']+)'/g)].map(([, id, key, displayName, assetUrl]) => serializeCharacter({ id, key, displayName, assetUrl }));
assert.equal(characters.length, 6);
const fixture = resolve(root, 'client/.phase2-preview.tsx');
const output = resolve(root, '.cache/phase2-review');
await mkdir(output, { recursive: true });
const metro = process.env.PHASE2_METRO_URL || 'http://localhost:8082';
const entry = `
import React, { useState } from 'react';
import { AppRegistry, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CharacterGallery } from './src/storybook/character-gallery';
import { PalaceHome } from './src/storybook/palace-home';
import { StoryDialog, StoryButton, s } from './src/storybook/story-ui';
const characters = ${JSON.stringify(characters)};
function Fixture() {
  const [saved, setSaved] = useState(() => localStorage.getItem('phase2-fixture-character'));
  const [gallery, setGallery] = useState(!saved);
  const [account, setAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const selected = characters.find(c => c.id === saved);
  return <SafeAreaProvider><View style={{flex:1}}>
    {gallery || !selected ? <CharacterGallery characters={characters} currentId={saved} busy={busy} onAccount={() => setAccount(true)} onBack={saved ? () => setGallery(false) : undefined} onChoose={c => {
      setBusy(true); setTimeout(() => { localStorage.setItem('phase2-fixture-character', c.id); setSaved(c.id); setBusy(false); setGallery(false); }, 200);
    }} /> : <PalaceHome key={selected.id} character={selected} username="starlit_soul" onCompanions={() => setGallery(true)} onAccount={() => setAccount(true)} onWrite={() => {}} />}
    {account && <StoryDialog title="Your little corner" onClose={() => setAccount(false)}><Text style={s.body}>Local visual fixture</Text><StoryButton label="Close account" onPress={() => setAccount(false)} secondary /></StoryDialog>}
  </View></SafeAreaProvider>;
}
AppRegistry.registerComponent('Phase2Preview', () => Fixture);
AppRegistry.runApplication('Phase2Preview', { rootTag: document.getElementById('root') });
`;
await writeFile(fixture, entry);
const server = createServer(async (req, res) => {
  if (req.url !== '/') {
    try {
      const asset = await fetch(`${metro}${req.url}`, { signal: AbortSignal.timeout(10_000) });
      res.writeHead(asset.status, { 'Content-Type': asset.headers.get('Content-Type') || 'application/octet-stream' });
      res.end(Buffer.from(await asset.arrayBuffer()));
    } catch { res.writeHead(502).end(); }
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body,#root{margin:0;height:100%;width:100%}#root{display:flex}body{background:#F8F4EA}</style></head><body><div id="root"></div><script src="${metro}/client/.phase2-preview.bundle?platform=web&dev=true&lazy=false"></script></body></html>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1060 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(route.request().url()) ? route.continue() : route.abort());
  await page.goto(url);
  await page.getByRole('radio').first().waitFor({ timeout: 120_000 });
  assert.equal(await page.getByRole('radio').count(), 6);
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  await page.screenshot({ path: resolve(output, '01-companions-desktop.png'), fullPage: true });
  await page.getByRole('radio', { name: /^Ember,/ }).focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByRole('radio', { name: /^Lune,/ }).getAttribute('aria-checked'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await page.getByRole('radio', { name: /^Ember,/ }).getAttribute('aria-checked'), 'true');
  for (const character of characters) {
    await page.getByRole('radio', { name: new RegExp(`^${character.displayName},`) }).click();
    assert.equal(await page.getByRole('radio', { name: new RegExp(`^${character.displayName},`) }).getAttribute('aria-checked'), 'true');
    await page.getByRole('button', { name: `Begin with ${character.displayName}` }).click();
    await page.getByRole('button', { name: 'Open the doors', exact: true }).waitFor();
    if (character.key === 'fox-lantern') {
      await page.screenshot({ path: resolve(output, '02-palace-doors.png'), fullPage: true });
      await page.getByRole('button', { name: 'Open the doors', exact: true }).click();
      // Capture an intermediate frame, and verify the animation eventually exits.
      await page.waitForTimeout(700);
      await page.screenshot({ path: resolve(output, '03-doors-opening.png') });
    } else await page.getByRole('button', { name: 'Skip to my palace' }).click();
    await page.getByRole('button', { name: 'Skip to my palace' }).waitFor({ state: 'hidden', timeout: 6000 });
    await page.getByRole('button', { name: 'Skip the walk' }).waitFor({ state: 'hidden', timeout: 5000 });
    await page.getByText(character.palace.name, { exact: true }).waitFor();
    if (character.key === 'fox-lantern') await page.screenshot({ path: resolve(output, '04-palace-desktop.png'), fullPage: true });
    if (character.key === 'fox-lantern') {
      const motion = page.getByRole('switch', { name: 'Ambient palace animation' });
      await motion.click();
      assert.equal(await motion.getAttribute('aria-checked'), 'false');
      await motion.click();
      assert.equal(await motion.getAttribute('aria-checked'), 'true');
    }
    await page.getByRole('button', { name: 'Companions', exact: true }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(output, '05-companions-phone.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Gallery must fit the phone width');
  await page.getByRole('radio', { name: /^Lune,/ }).click();
  await page.getByRole('button', { name: 'Begin with Lune' }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: resolve(output, '07-companion-preview-phone.png'), fullPage: true });
  await page.getByRole('button', { name: 'Begin with Lune' }).click();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Open the doors', exact: true }).click();
  await page.getByRole('button', { name: 'Skip to my palace' }).waitFor({ state: 'hidden', timeout: 1000 });
  await page.screenshot({ path: resolve(output, '06-palace-phone.png'), fullPage: true });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Palace must fit the phone width');
  await page.getByRole('button', { name: 'Open the doors again' }).click();
  await page.getByRole('button', { name: 'Skip to my palace' }).click();
  await page.getByRole('button', { name: 'Account', exact: true }).click();
  await page.getByText('Your little corner', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByText('Your little corner', { exact: true }).waitFor({ state: 'hidden' });
  await page.reload();
  await page.getByRole('button', { name: 'Skip to my palace' }).click();
  await page.getByText('The Moonflower Palace', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('UI checks passed: six companions, keyboard selection, palace variants, opening/skip/replay, reduced motion, ambient toggle, phone overflow, dialog dismissal, and fixture restoration.');
  console.log('Visual evidence saved to .cache/phase2-review. Auth and persistence use separate API tests; this preview uses local fixtures.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
  await unlink(fixture);
}
