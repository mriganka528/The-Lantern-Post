import type { VoiceClip } from '@lantern-post/shared-types';
export const MAX_VOICE_MS = 180_000;
export const MAX_VOICE_BYTES = 8 * 1024 * 1024;
export function cleanVoiceClip(value: unknown): VoiceClip | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.id) || !['audio/webm', 'audio/mp4'].includes(String(v.mimeType)) ||
    typeof v.byteLength !== 'number' || !Number.isSafeInteger(v.byteLength) || v.byteLength < 64 || v.byteLength > MAX_VOICE_BYTES ||
    typeof v.durationMs !== 'number' || !Number.isSafeInteger(v.durationMs) || v.durationMs < 1000 || v.durationMs > MAX_VOICE_MS) return null;
  return { id: v.id.toLowerCase(), mimeType: v.mimeType as VoiceClip['mimeType'], byteLength: v.byteLength, durationMs: v.durationMs };
}
export function voiceTime(ms: number) { const seconds = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
export interface VoiceRecording { bytes: Uint8Array; mimeType: VoiceClip['mimeType']; durationMs: number; }
export interface VoiceCapture { stop(): Promise<VoiceRecording>; cancel(): void; }
export interface VoiceRecorderDriver { available(): boolean; start(onMeter: (level: number) => void, onEnded: () => void, signal?: AbortSignal): Promise<VoiceCapture>; }
export interface VoiceStore {
  save(ownerId: string, clip: VoiceClip, bytes: Uint8Array): Promise<void>;
  read(ownerId: string, clip: VoiceClip): Promise<Uint8Array>;
  remove(ownerId: string, clipId: string): Promise<void>;
  playback(ownerId: string, clip: VoiceClip): Promise<{ uri: string; release(): void }>;
  sha256(bytes: Uint8Array): Promise<string>;
}
