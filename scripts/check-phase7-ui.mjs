// Real MediaRecorder/playback with a synthetic microphone signal; isolated
// Nest/DB/object-store/moderator fixtures. Never records the user's microphone.
import assert from 'node:assert/strict';
import { readStoredLetter } from './browser-letter-storage.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url)); const require = createRequire(import.meta.url); const clientRequire = createRequire(resolve(root, 'client/package.json'));
const webpack = require('webpack'); let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('../.cache/art-tools/node_modules/playwright')); }
const { createFriendsTestApp } = require('../server/dist-test/test/friends-fixture.js'); const { memoryVoiceStorage } = require('../server/dist-test/test/voice-fixture.js');
const { serializePreset } = require('../server/dist-test/src/presets/preset.js');
const media = memoryVoiceStorage(); const backend = await createFriendsTestApp(false, { available: true, voiceAvailable: true, check: async () => 'APPROVED', checkVoice: async () => 'APPROVED' }, media.storage);
const errors = []; const uploads = [];
const objectServer = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*'); response.setHeader('Cache-Control', 'private, no-store');
  if (request.method === 'OPTIONS') { response.setHeader('Access-Control-Allow-Methods', 'PUT,GET,HEAD,OPTIONS'); response.setHeader('Access-Control-Allow-Headers', 'content-type'); response.writeHead(204); response.end(); return; }
  try {
    assert.equal(request.headers.authorization, undefined, 'Session tokens must never go to object storage.');
    if (request.method === 'PUT' && request.url.startsWith('/upload/')) {
      const chunks = []; for await (const chunk of request) chunks.push(chunk); const body = Buffer.concat(chunks);
      assert.equal(Number(request.headers['content-length']), body.length, 'The browser supplies the signed content length on the wire.');
      const key = request.url.slice('/upload/'.length); uploads.push(key); media.objects.set(key, body); response.end(); return;
    }
    const bytes = media.objects.get(request.url.slice('/play/'.length)); if (!bytes) { response.writeHead(404); response.end(); return; }
    response.setHeader('Content-Type', 'audio/webm'); response.end(Buffer.from(bytes));
  } catch (error) { errors.push(error.message); response.writeHead(500); response.end(); }
});
await new Promise(resolve => objectServer.listen(0, '127.0.0.1', resolve)); const objectOrigin = `http://127.0.0.1:${objectServer.address().port}`;
media.storage.upload = (key, _bytes, _mime, seconds = 600) => ({ url: `${objectOrigin}/upload/${key}`, expiresAt: new Date(Date.now() + seconds * 1000) });
media.storage.playback = key => ({ url: `${objectOrigin}/play/${key}`, expiresAt: new Date(Date.now() + 300_000) });
backend.fixture.state.requests.push({ id: 'friendship_ab', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date(), respondedAt: new Date() });
const preset = serializePreset(backend.fixture.state.presets[0]);
const output = resolve(root, '.cache/phase7-review'); await mkdir(output, { recursive: true });
const samples = 48000 * 3; const wav = Buffer.alloc(44 + samples * 2); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(48000, 24); wav.writeUInt32LE(96000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(samples * 2, 40);
for (let i = 0; i < samples; i++) wav.writeInt16LE(Math.round(Math.sin(i * 2 * Math.PI * 330 / 48000) * 6000), 44 + i * 2);
const wavPath = resolve(output, 'synthetic-microphone.wav'); await writeFile(wavPath, wav);
const entry = resolve(root, '.cache/phase7-ui-entry.tsx'); const loader = resolve(root, '.cache/phase7-tsx-loader.cjs');
await writeFile(loader, `const ts=require('typescript');module.exports=function(source){return ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;};`);
await writeFile(entry, `
import React, { useEffect, useMemo, useState } from 'react';
import { AppRegistry } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionDataProvider } from '../client/src/api/session-data-provider';
import { WritingDesk } from '../client/src/letters/writing-desk';
import { PalaceLetterbox } from '../client/src/letters/letterbox';
import { createBurnTransport } from '../client/src/letters/burn-api';
import { createDeliveryTransport, createLetterBoxTransport } from '../client/src/letters/friend-letter-api';
import { createFriendsTransport } from '../client/src/friends/friends-api';
import { voiceStorage } from '../client/src/voice/voice-storage';
const presets = [${JSON.stringify(preset)}];
const fixture = { failCleanup: false };
const remove = voiceStorage.remove;
voiceStorage.remove = async (...args) => { if(fixture.failCleanup) throw new Error('Synthetic delete failure'); return remove(...args); };
function Account({ owner }) {
  const [screen, setScreen] = useState(new URLSearchParams(location.search).get('screen') || 'writing');
  const token = useMemo(() => async () => owner, [owner]); const ownerId = 'owner-' + owner;
  const delivery = useMemo(() => createDeliveryTransport(token, ownerId), [token, ownerId]); const burn = useMemo(() => createBurnTransport(token), [token]);
  const friends = useMemo(() => createFriendsTransport(token), [token]); const box = useMemo(() => createLetterBoxTransport(token), [token]);
  return screen === 'writing' ? <WritingDesk key={owner} ownerId={ownerId} presets={presets} onRetryCatalog={() => {}} onBack={() => setScreen('inbox')} deliveryTransport={delivery} burnTransport={burn} friendsTransport={friends} characterKey="fox-lantern" /> : <PalaceLetterbox ownerId={ownerId} api={box} onBack={() => setScreen('writing')} onWrite={() => setScreen('writing')} />;
}
function Fixture() { const [owner, setOwner] = useState(new URLSearchParams(location.search).get('owner') || 'alice');
  useEffect(() => { window.__phase7 = { fixture, voiceStorage, setOwner }; }, []);
  return <SafeAreaProvider><SessionDataProvider key={owner}><Account key={owner} owner={owner} /></SessionDataProvider></SafeAreaProvider>;
}
AppRegistry.registerComponent('Phase7Review', () => () => <React.StrictMode><Fixture /></React.StrictMode>);
AppRegistry.runApplication('Phase7Review', { rootTag: document.getElementById('root') });
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
  console.log('Phase 7 voice fixture compiled.');
  browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome', args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${wavPath}`, '--mute-audio'] });
  async function pageFor(owner, screen = 'writing') {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' }); page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => { const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices); window.__micTracks = []; window.__denyMic = false;
      navigator.mediaDevices.getUserMedia = async constraints => { if(window.__denyMic) throw new DOMException('Synthetic denial', 'NotAllowedError'); const stream = await original(constraints); window.__micTracks.push(...stream.getTracks()); return stream; };
    });
    await page.route(/^https?:\/\//, async route => {
      const url = new URL(route.request().url());
      if (url.origin === 'https://api.example.invalid') { const response = await route.fetch({ url: backend.url + url.pathname + url.search }); return route.fulfill({ response, headers: { ...response.headers(), 'Access-Control-Allow-Origin': '*' } }); }
      if (url.origin === objectOrigin) return route.continue();
      return route.abort();
    });
    await page.goto(pathToFileURL(resolve(output, 'index.html')).href + '?owner=' + owner + '&screen=' + screen); return page;
  }
  const alice = await pageFor('alice'); const stored = () => readStoredLetter(alice, 'owner-alice');
  async function record() {
    await alice.getByRole('tab', { name: 'A voice letter', exact: true }).click(); await alice.getByRole('button', { name: 'Record my voice', exact: true }).click();
    await alice.getByRole('button', { name: 'Stop recording', exact: true }).waitFor(); await alice.waitForTimeout(2400); await alice.getByRole('button', { name: 'Stop recording', exact: true }).click();
    await alice.getByRole('button', { name: 'Play voice letter', exact: true }).waitFor();
    assert.ok(await alice.evaluate(() => window.__micTracks.every(track => track.readyState === 'ended')));
    return (await stored()).voice;
  }
  await alice.getByRole('tab', { name: 'A voice letter', exact: true }).click(); await alice.evaluate(() => { window.__denyMic = true; });
  await alice.getByRole('button', { name: 'Record my voice', exact: true }).click(); await alice.getByText('The microphone could not be opened. Check its permission and try again.', { exact: true }).waitFor(); assert.equal((await stored()).voice, null);
  await alice.evaluate(() => { window.__denyMic = false; }); const clip = await record(); assert.equal(clip.mimeType, 'audio/webm'); assert.ok(clip.durationMs >= 1000 && clip.durationMs <= 180000);
  await alice.getByRole('button', { name: 'Play voice letter', exact: true }).click(); await alice.waitForFunction(() => document.querySelector('audio').currentTime > .1);
  await alice.getByRole('button', { name: 'Pause voice letter', exact: true }).click(); await alice.screenshot({ path: resolve(output, '01-vintage-voice-composer.png') });
  await alice.reload(); await alice.getByRole('button', { name: 'Play voice letter', exact: true }).waitFor(); assert.equal((await stored()).voice.id, clip.id); assert.equal(await alice.evaluate(() => window.__micTracks.length), 0);
  await alice.getByRole('button', { name: 'Seal my letter', exact: true }).click(); await alice.getByRole('button', { name: 'Let it go to the fire', exact: true }).click();
  await alice.evaluate(() => { window.__phase7.fixture.failCleanup = true; }); await alice.getByRole('button', { name: 'Burn this letter', exact: true }).click();
  await alice.getByRole('button', { name: 'Finish clearing this letter', exact: true }).waitFor(); assert.equal(uploads.length, 0); assert.equal(backend.fixture.state.voiceAssets.length, 0);
  assert.equal(await alice.getByTestId('burn-flames').evaluate(e => getComputedStyle(e).opacity), '0');
  await alice.evaluate(() => { window.__phase7.fixture.failCleanup = false; }); await alice.getByRole('button', { name: 'Finish clearing this letter', exact: true }).click();
  await alice.getByRole('button', { name: 'Write another letter', exact: true }).waitFor();
  assert.equal(await alice.evaluate(async clip => { try { await window.__phase7.voiceStorage.read('owner-alice', clip); return true; } catch { return false; } }, clip), false);
  await alice.getByRole('button', { name: 'Write another letter', exact: true }).click(); await alice.getByRole('textbox', { name: 'Your letter' }).waitFor();
  const second = await record(); await alice.getByRole('button', { name: 'Seal my letter', exact: true }).click(); await alice.getByRole('button', { name: "Send to a friend's gate", exact: true }).click(); await alice.getByRole('radio', { name: 'Send to bob', exact: true }).click();
  await alice.getByRole('button', { name: 'Preview the journey', exact: true }).click(); await alice.getByRole('button', { name: 'Return to my sealed letter', exact: true }).click(); assert.equal(uploads.length, 0);
  await alice.getByRole('button', { name: 'Send my letter to bob', exact: true }).click(); await alice.getByRole('button', { name: 'Return to my palace', exact: true }).waitFor({ timeout: 20000 });
  assert.equal(uploads.length, 1); const delivered = backend.fixture.state.letters.find(row => row.destinationType === 'FRIEND'); assert.equal(delivered.type, 'VOICE'); assert.equal(delivered.textContent, null);
  assert.equal(await alice.evaluate(async clip => { try { await window.__phase7.voiceStorage.read('owner-alice', clip); return true; } catch { return false; } }, second), false);
  const bob = await pageFor('bob', 'inbox'); await bob.getByRole('button', { name: 'Open letter from alice, unopened', exact: true }).click(); await bob.getByRole('button', { name: 'Break the seal', exact: true }).click();
  await bob.getByRole('button', { name: 'Play voice letter', exact: true }).click(); await bob.waitForFunction(() => document.querySelector('audio').currentTime > .1);
  await bob.getByRole('button', { name: 'Pause voice letter', exact: true }).click(); await bob.setViewportSize({ width: 390, height: 844 }); await bob.screenshot({ path: resolve(output, '02-private-voice-player-phone.png') });
  assert.ok(await bob.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await bob.getByRole('button', { name: 'Remove this letter', exact: true }).click(); await bob.getByRole('button', { name: 'Remove from my letterbox', exact: true }).click(); await bob.getByText('The post is quiet, for now.', { exact: true }).waitFor();
  await backend.voiceAssets.cleanup(); assert.equal(media.objects.has(backend.fixture.state.voiceAssets[0].storageKey), true);
  await fetch(backend.url+'/letters/friends/'+delivered.id+'/delete',{method:'POST',headers:{Authorization:'Bearer alice','Content-Type':'application/json'},body:'{}'});await backend.voiceAssets.cleanup();assert.equal(media.objects.has(backend.fixture.state.voiceAssets[0].storageKey),false);
  assert.deepEqual(errors, []); console.log('Phase 7 browser checks passed: real synthetic-mic capture, permission denial, playback/persistence, no-upload voice burning, cleanup retry, fresh desk, preview, private upload/validation/delivery/playback and deletion.');
} finally { if (browser) await browser.close(); await backend.app.close(); await new Promise(resolve => objectServer.close(resolve)); }
