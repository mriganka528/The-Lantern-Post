import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { signupNextStep } from '../src/auth/email-flow';
import { voiceDigestBase64 } from '../src/voice/voice-hash';
import { startVoicePlayback } from '../src/voice/playback-operation';
import { worldDeliveryProblem } from '../src/infinity/world-contract';

test('verified signup requests only the remaining Clerk fields instead of retrying the email code', () => {
  const verified = { status: 'missing_requirements', createdSessionId: null, missingFields: ['password', 'first_name'], unverifiedFields: [], verifications: { emailAddress: { status: 'verified' } } };
  assert.deepEqual(signupNextStep(verified), { kind: 'details', fields: ['password', 'first_name'] });
  assert.deepEqual(signupNextStep({ ...verified, status: 'complete', createdSessionId: 'verified-session', missingFields: [] }), { kind: 'complete', sessionId: 'verified-session' });
  assert.throws(() => signupNextStep({ ...verified, verifications: { emailAddress: { status: 'unverified' } } }), /not been verified/);
  assert.throws(() => signupNextStep({ ...verified, missingFields: ['phone_number'] }), /another verification method/);
  assert.throws(() => signupNextStep({ ...verified, status: 'complete', createdSessionId: null }), /account was created/);
});
test('binary voice checksums match the upload API without browser base64 globals', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'btoa');
  Object.defineProperty(globalThis, 'btoa', { value: undefined, configurable: true });
  try {
    for (const content of [Buffer.from('recording'), randomBytes(500), Buffer.alloc(70000, 255)]) {
      const hash = createHash('sha256').update(content).digest();
      assert.equal(voiceDigestBase64(Uint8Array.from(hash).buffer), hash.toString('base64'));
    }
    assert.throws(() => voiceDigestBase64(new ArrayBuffer(31)));
  } finally { if (original) Object.defineProperty(globalThis, 'btoa', original); else Reflect.deleteProperty(globalThis, 'btoa'); }
});
test('restart pauses, seeks to zero and explicitly resumes; leaving the screen prevents late playback', async () => {
  const calls: string[] = []; let active = true;
  const player = { pause: () => { calls.push('pause'); }, play: () => { calls.push('play'); }, seekTo: async (time: number) => { calls.push('seek:' + time); } };
  await startVoicePlayback(player, async () => { calls.push('configure'); }, () => active, true);
  assert.deepEqual(calls, ['pause', 'configure', 'seek:0', 'play']); calls.length = 0;
  await startVoicePlayback(player, async () => { active = false; }, () => active, true);
  assert.deepEqual(calls, ['pause']); calls.length = 0; active = true;
  await startVoicePlayback({ ...player, seekTo: async () => { active = false; } }, async () => {}, () => active, true);
  assert.deepEqual(calls, ['pause']);
});
test('public voice failures explain recovery without claiming an unknown send succeeded or exposing errors', () => {
  assert.match(worldDeliveryProblem({ code: 'VOICE_INVALID' }), /validated/);
  assert.match(worldDeliveryProblem({ code: 'VOICE_UPLOAD_EXPIRED' }), /expired/);
  assert.match(worldDeliveryProblem({ status: 401 }), /Sign in again/);
  assert.match(worldDeliveryProblem({ name: 'ApiTimeoutError' }), /Check its status/);
  assert.ok(!worldDeliveryProblem(Error('private credentials')).includes('credentials'));
});
