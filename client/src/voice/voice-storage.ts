import { Directory, File, Paths } from 'expo-file-system';
import { CryptoDigestAlgorithm, digest } from 'expo-crypto';
import type { VoiceStore } from './voice-contract';
import { cleanVoiceClip } from './voice-contract';
import { assertAccountOpen } from '../account/account-fence';
import { hashNativeVoice } from './voice-hash';
function files(ownerId: string, clipId: string, mimeType: 'audio/webm' | 'audio/mp4' = 'audio/mp4') {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(ownerId) || !/^[a-f0-9-]{36}$/i.test(clipId)) throw new Error('Invalid recording owner.');
  const directory = new Directory(Paths.document, 'lantern-voice', ownerId);
  return { directory, file: new File(directory, `${clipId}.${mimeType === 'audio/webm' ? 'webm' : 'm4a'}`) };
}
export const voiceStorage: VoiceStore = {
  async save(ownerId, clip, bytes) {
    assertAccountOpen(ownerId);
    if (!cleanVoiceClip(clip) || bytes.byteLength !== clip.byteLength) throw new Error('Invalid recording.');
    const { directory, file } = files(ownerId, clip.id, clip.mimeType); directory.create({ intermediates: true, idempotent: true }); file.write(bytes);
  },
  async read(ownerId, clip) { const { file } = files(ownerId, clip.id, clip.mimeType); if (!file.exists || file.size !== clip.byteLength) throw new Error('The saved recording is unavailable.'); return file.bytes(); },
  async remove(ownerId, clipId) { for (const mimeType of ['audio/webm', 'audio/mp4'] as const) { const { file } = files(ownerId, clipId, mimeType); if (file.exists) file.delete(); } },
  async playback(ownerId, clip) { const { file } = files(ownerId, clip.id, clip.mimeType); if (!file.exists) throw new Error('The saved recording is unavailable.'); return { uri: file.uri, release: () => {} }; },
  async sha256(bytes) { return hashNativeVoice(bytes, data => digest(CryptoDigestAlgorithm.SHA256, data)); },
};
export async function eraseVoiceOwner(ownerId: string) { if (!/^[a-zA-Z0-9_-]{1,100}$/.test(ownerId)) throw Error(); const directory = new Directory(Paths.document,'lantern-voice',ownerId); if (directory.exists) directory.delete(); }
