import type { VoiceClip } from '@lantern-post/shared-types';
import type { VoiceStore } from './voice-contract';

class VoicePreparationError extends Error {
  constructor(readonly code: 'VOICE_LOCAL_UNAVAILABLE' | 'VOICE_PREPARATION_FAILED') {
    super('The recording could not be prepared.');
  }
}

export async function prepareVoiceUpload(store: Pick<VoiceStore, 'read' | 'sha256'>, ownerId: string, clip: VoiceClip) {
  let bytes: Uint8Array;
  try {
    bytes = await store.read(ownerId, clip);
    if (bytes.byteLength !== clip.byteLength) throw Error('Recording changed');
  } catch { throw new VoicePreparationError('VOICE_LOCAL_UNAVAILABLE'); }
  let sha256: string;
  try {
    sha256 = await store.sha256(bytes);
    if (!/^[A-Za-z0-9+/]{43}=$/.test(sha256)) throw Error('Invalid digest');
  } catch { throw new VoicePreparationError('VOICE_PREPARATION_FAILED'); }
  return { bytes, sha256 };
}

export function voicePreparationProblem(error: unknown): string | null {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  if (code === 'VOICE_LOCAL_UNAVAILABLE') return 'The saved recording could not be opened on this device. Check this delivery’s status, or cancel it to return to your letter and record a new take.';
  if (code === 'VOICE_PREPARATION_FAILED') return 'The recording could not be prepared for upload. Your letter is kept. Check its status, then retry with the latest app version.';
  return null;
}
