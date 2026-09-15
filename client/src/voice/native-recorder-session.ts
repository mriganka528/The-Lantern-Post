import type { VoiceCapture, VoiceRecorderDriver, VoiceRecording } from './voice-contract';
import { MAX_VOICE_BYTES, MAX_VOICE_MS } from './voice-contract';

export interface NativeRecorderStatus { durationMillis: number; metering?: number; isRecording: boolean; url?: string | null }
export interface NativeRecorderHandle {
  prepare(): Promise<void>; record(): void; stop(): Promise<void>; release(): void;
  status(): NativeRecorderStatus; uri(): string | null;
  listen(callback: (finished: boolean, uri?: string | null) => void): () => void;
}
export interface NativeRecorderPort {
  hasPermission(): Promise<boolean>; requestPermission(): Promise<boolean>; foreground(signal: AbortSignal): Promise<boolean>; isForeground(): boolean;
  enableAudio(): Promise<void>; disableAudio(): Promise<void>; create(): NativeRecorderHandle;
  read(uri: string): Promise<Uint8Array>; remove(uri: string): void;
}

// Only this operation can exempt its OS permission sheet from background cancellation.
// Every later phase still checks the original abort signal and actual foreground state.
export function createNativeRecorderDriver(port: NativeRecorderPort): VoiceRecorderDriver {
  let permissionOwner: AbortSignal | undefined; let occupied = false;
  return {
    available: () => true,
    permissionPromptActive: signal => Boolean(signal && permissionOwner === signal && !signal.aborted),
    async start(onMeter, onEnded, suppliedSignal) {
      const signal = suppliedSignal ?? new AbortController().signal;
      if (occupied || signal.aborted) throw Error('Microphone unavailable');
      occupied = true;
      let recorder: NativeRecorderHandle | undefined, unsubscribe: (() => void) | undefined;
      let timer: ReturnType<typeof setInterval> | undefined;
      let released = false, duration = 0, uri: string | null = null, stopResult: Promise<VoiceRecording> | null = null;
      const active = () => { if (signal.aborted || !port.isForeground()) throw Error('Recording interrupted'); };
      const sample = () => {
        if (!recorder || released) return;
        const status = recorder.status();
        if (Number.isFinite(status.durationMillis)) duration = Math.max(duration, status.durationMillis);
        uri = status.url || recorder.uri() || uri;
        onMeter(status.metering === undefined ? 0 : Math.min(1, 10 ** (status.metering / 20) * 3));
      };
      const release = async () => {
        if (released) return; released = true; clearInterval(timer); unsubscribe?.(); onMeter(0);
        try { recorder?.release(); } finally {
          try { if (uri) port.remove(uri); } catch { /* The OS can reclaim an abandoned cache file. */ }
          try { await port.disableAudio(); } catch { /* Keep successfully captured bytes. */ }
          occupied = false;
        }
      };
      try {
        active(); const permitted = await port.hasPermission(); active();
        if (!permitted) {
          permissionOwner = signal;
          try {
            if (!await port.requestPermission() || signal.aborted) throw Error('Microphone permission required');
            if (!await port.foreground(signal)) throw Error('Recording interrupted');
          } finally { if (permissionOwner === signal) permissionOwner = undefined; }
        }
        active(); await port.enableAudio(); active();
        recorder = port.create();
        unsubscribe = recorder.listen((finished, location) => { if (location) uri = location; if (!released && finished) onEnded(); });
        await recorder.prepare(); active(); recorder.record(); sample();
        if (!recorder.status().isRecording) throw Error('Microphone did not start');
        timer = setInterval(() => { try { sample(); } catch { onEnded(); } }, 150);
      } catch {
        try { if (recorder) { uri = recorder.uri() || uri; if (recorder.status().isRecording) await recorder.stop(); } } catch { /* Release still runs. */ }
        await release(); throw Error('The microphone could not be started.');
      }
      const stop = (): Promise<VoiceRecording> => {
        if (stopResult) return stopResult;
        stopResult = (async () => {
          try {
            sample(); if (recorder!.status().isRecording) await recorder!.stop();
            sample(); uri = recorder!.uri() || uri;
            if (!uri) throw Error('No recording');
            const bytes = await port.read(uri);
            if (bytes.byteLength < 64 || bytes.byteLength > MAX_VOICE_BYTES) throw Error('Invalid recording size');
            return { bytes, mimeType: 'audio/mp4' as const, durationMs: Math.min(MAX_VOICE_MS, Math.round(duration)) };
          } finally { await release(); }
        })();
        void stopResult.catch(() => {}); return stopResult;
      };
      const capture: VoiceCapture = { stop, cancel: () => { if (!released) void stop().catch(() => {}); } };
      return capture;
    },
  };
}
