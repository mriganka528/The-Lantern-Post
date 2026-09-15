import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as voiceHash from '../src/voice/voice-hash';
import * as voiceContract from '../src/voice/voice-contract';
import { hashNativeVoice } from '../src/voice/voice-hash';
import { playbackHasEnded, startVoicePlayback, type PlaybackStatus } from '../src/voice/playback-operation';
import { prepareVoiceUpload, voicePreparationProblem } from '../src/voice/voice-upload';
import { worldDeliveryProblem } from '../src/infinity/world-contract';

test('the production native voice store hashes through the installed Expo SDK with its TypedArray bridge contract', async () => {
  function moduleFrom(file: string, dependencies: Record<string, unknown>): Record<string, unknown> {
    const module = { exports: {} };
    const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, esModuleInterop: true } }).outputText;
    runInNewContext(source, { module, exports: module.exports, Uint8Array, ArrayBuffer, require: (name: string) => {
      if (!(name in dependencies)) throw Error('Unexpected fixture import: ' + name);
      return dependencies[name];
    } }, { filename: file });
    return module.exports;
  }
  const sdkRoot = dirname(require.resolve('expo-crypto/package.json'));
  const native = { digest: (algorithm: string, output: Uint8Array, data: Uint8Array) => {
    assert.equal(algorithm, 'SHA-256');
    assert.ok(data instanceof Uint8Array, 'Native ExpoCrypto requires a typed view, not a raw ArrayBuffer');
    output.set(createHash('sha256').update(data).digest());
  } };
  const sdk = moduleFrom(resolve(sdkRoot, 'src/Crypto.ts'), {
    'expo-modules-core': { UnavailabilityError: Error }, './aes': {}, './ExpoCrypto': native,
    './Crypto.types': moduleFrom(resolve(sdkRoot, 'src/Crypto.types.ts'), {}),
  }) as { digest: (algorithm: string, data: ArrayBuffer | Uint8Array) => Promise<ArrayBuffer>; CryptoDigestAlgorithm: { SHA256: string } };
  const production = moduleFrom(resolve(__dirname, '../../src/voice/voice-storage.ts'), {
    'expo-file-system': {}, 'expo-crypto': sdk, './voice-contract': voiceContract,
    './voice-hash': voiceHash, '../account/account-fence': {},
  }) as { voiceStorage: { sha256: (bytes: Uint8Array) => Promise<string> } };
  const bytes = Uint8Array.from(randomBytes(1024)).subarray(16, 700);
  // Reproduce the old failure against the installed JS wrapper, then verify
  // the actual production store now obeys the native module's contract.
  await assert.rejects(sdk.digest(sdk.CryptoDigestAlgorithm.SHA256, bytes.slice().buffer), /typed view/);
  assert.equal(await production.voiceStorage.sha256(bytes), createHash('sha256').update(bytes).digest('base64'));
});

test('native checksums pass a typed byte view to the Expo bridge, including recordings at a buffer offset', async () => {
  const storage = randomBytes(4096);
  for (const bytes of [Uint8Array.from(storage), new Uint8Array(storage.buffer, storage.byteOffset + 27, 251), new Uint8Array(70000).fill(255)]) {
    const expected = createHash('sha256').update(bytes).digest('base64');
    const actual = await hashNativeVoice(bytes, async data => {
      // Expo's native bridge reads the view's .buffer, .byteOffset and .length.
      // A raw ArrayBuffer was accepted by our old browser fixture, not Android.
      assert.ok(data instanceof Uint8Array);
      assert.ok(data.buffer instanceof ArrayBuffer);
      assert.equal(data.byteOffset, 0);
      assert.equal(data.byteLength, bytes.byteLength);
      assert.notEqual(data.buffer, bytes.buffer);
      return Uint8Array.from(createHash('sha256').update(data).digest()).buffer;
    });
    assert.equal(actual, expected);
  }
});

test('native restart reloads the source and waits for zero before explicitly playing', async () => {
  const calls: string[] = [];
  const statuses: PlaybackStatus[] = [
    { isLoaded: true, currentTime: 2.9, duration: 3, playbackState: 'ended', didJustFinish: false },
    { isLoaded: false, currentTime: 0, playbackState: 'loading' },
    { isLoaded: true, currentTime: 0, playbackState: 'readyToPlay' },
  ];
  await startVoicePlayback({
    pause: () => { calls.push('pause'); }, play: () => { calls.push('play'); },
    seekTo: async () => { assert.fail('Native restart must reopen an ended source'); },
    reload: () => { calls.push('reload'); }, status: () => statuses.shift()!,
  }, async () => { calls.push('configure'); }, () => true, true);
  assert.equal(statuses.length, 0);
  assert.deepEqual(calls, ['pause', 'configure', 'reload', 'play']);
  assert.equal(playbackHasEnded({ isLoaded: true, currentTime: 2.9, duration: 3, playbackState: 'ended', didJustFinish: false }), true);
  assert.equal(playbackHasEnded({ isLoaded: true, currentTime: 3, duration: 3, didJustFinish: false }), true);
  assert.equal(playbackHasEnded({ isLoaded: true, currentTime: 1, duration: 3 }), false);
});

test('leaving or backgrounding while native reload waits prevents late playback', async () => {
  let active = true, played = false;
  await startVoicePlayback({
    pause() {}, play: () => { played = true; }, seekTo: async () => {}, reload() {},
    status: () => { active = false; return { isLoaded: true, currentTime: 0 }; },
  }, async () => {}, () => active, true);
  assert.equal(played, false);
});

test('a native reload error or timeout never starts playback', async context => {
  const player = { pause() {}, play: () => { assert.fail('An unavailable source must not play'); }, seekTo: async () => {}, reload() {}, status: (): PlaybackStatus => ({ isLoaded: false, currentTime: 0, error: 'native failure' }) };
  await assert.rejects(startVoicePlayback(player, async () => {}, () => true, true), /unavailable/);
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'] });
  const pending = startVoicePlayback({ ...player, status: () => ({ isLoaded: false, currentTime: 0 }) }, async () => {}, () => true, true);
  await Promise.resolve();
  context.mock.timers.tick(7600);
  await assert.rejects(pending, /timed out/);
});

test('pre-upload errors distinguish missing local bytes from checksum failure without leaking native errors', async () => {
  const bytes = new Uint8Array(128).fill(10);
  const clip = { id: '70000000-0000-4000-8000-000000000001', mimeType: 'audio/mp4' as const, byteLength: 128, durationMs: 2000 };
  const good = { read: async () => bytes, sha256: async (data: Uint8Array) => createHash('sha256').update(data).digest('base64') };
  assert.equal((await prepareVoiceUpload(good, 'owner-a', clip)).sha256, await good.sha256(bytes));
  for (const [store, code, phrase] of [
    [{ ...good, read: async () => { throw Error('private file location'); } }, 'VOICE_LOCAL_UNAVAILABLE', /opened on this device/],
    [{ ...good, read: async () => bytes.subarray(1) }, 'VOICE_LOCAL_UNAVAILABLE', /opened on this device/],
    [{ ...good, sha256: async () => { throw Error('private native stack'); } }, 'VOICE_PREPARATION_FAILED', /prepared for upload/],
    [{ ...good, sha256: async () => 'invalid' }, 'VOICE_PREPARATION_FAILED', /prepared for upload/],
  ] as const) {
    await assert.rejects(prepareVoiceUpload(store, 'owner-a', clip), (error: unknown) => {
      assert.equal((error as { code: string }).code, code);
      assert.match(voicePreparationProblem(error)!, phrase);
      assert.match(worldDeliveryProblem(error), phrase);
      assert.ok(!String(error).includes('private'));
      return true;
    });
  }
});
