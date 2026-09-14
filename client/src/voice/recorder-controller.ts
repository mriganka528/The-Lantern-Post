import type { VoiceClip } from '@lantern-post/shared-types';
import type { VoiceCapture, VoiceRecorderDriver, VoiceStore } from './voice-contract';
import { cleanVoiceClip, MAX_VOICE_MS } from './voice-contract';
import { pauseVoicePlayback } from './playback-registry';
export interface RecorderSnapshot { phase: 'idle' | 'permission' | 'recording' | 'saving' | 'error'; elapsedMs: number; level: number; error: string | null; }
export class RecorderController {
  private snapshot: RecorderSnapshot = { phase: 'idle', elapsedMs: 0, level: 0, error: null };
  private listeners = new Set<() => void>(); private generation = 0; private capture: VoiceCapture | null = null;
  private timer: ReturnType<typeof setInterval> | undefined; private stopping = false;
  private abort: AbortController | null = null;
  constructor(private readonly driver: VoiceRecorderDriver, private readonly store: VoiceStore, private readonly ownerId: string, private readonly attach: (clip: VoiceClip) => boolean, private readonly makeId: () => string) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: Partial<RecorderSnapshot>) { this.snapshot = { ...this.snapshot, ...value }; this.listeners.forEach(listener => listener()); }
  async start() {
    if (['permission', 'recording', 'saving'].includes(this.snapshot.phase)) return;
    const generation = ++this.generation; let ended = false;
    pauseVoicePlayback(); this.abort = new AbortController();
    this.publish({ phase: 'permission', elapsedMs: 0, level: 0, error: null });
    try {
      const capture = await this.driver.start(level => { if (this.generation === generation) this.publish({ level }); }, () => { ended = true; if (this.generation === generation && this.capture) void this.stop(); }, this.abort.signal);
      if (generation !== this.generation) { capture.cancel(); return; }
      this.capture = capture; const start = Date.now(); this.publish({ phase: 'recording' });
      this.timer = setInterval(() => { const elapsedMs = Math.min(MAX_VOICE_MS, Date.now() - start); this.publish({ elapsedMs }); if (elapsedMs >= MAX_VOICE_MS - 500) void this.stop(); }, 200);
      if (ended) await this.stop();
    } catch { if (this.generation === generation) this.publish({ phase: 'error', error: 'The microphone could not be opened. Check its permission and try again.' }); }
  }
  async stop() {
    if (!this.capture || this.stopping) return; this.stopping = true;
    const generation = this.generation; const capture = this.capture; clearInterval(this.timer); this.publish({ phase: 'saving', level: 0 });
    let savedId: string | null = null; let attached = false;
    try {
      const recording = await capture.stop(); if (generation !== this.generation) return;
      const clip = cleanVoiceClip({ id: this.makeId(), mimeType: recording.mimeType, byteLength: recording.bytes.byteLength, durationMs: recording.durationMs });
      if (!clip) throw new Error('Invalid recording');
      savedId = clip.id; await this.store.save(this.ownerId, clip, recording.bytes);
      if (generation !== this.generation || !this.attach(clip)) throw new Error('The page changed');
      attached = true; this.publish({ phase: 'idle', elapsedMs: clip.durationMs });
    } catch { if (generation === this.generation) this.publish({ phase: 'error', error: 'The recording could not be kept. Record at least one second, and try again.' }); }
    finally {
      if (savedId && !attached) await this.store.remove(this.ownerId, savedId).catch(() => {});
      capture.cancel(); if (generation === this.generation) { this.capture = null; this.stopping = false; }
    }
  }
  background() {
    if (this.snapshot.phase === 'permission') {
      this.generation++; this.abort?.abort();
      this.publish({ phase: 'idle', elapsedMs: 0, level: 0, error: null });
      return;
    }
    void this.stop();
  }
  dispose() { this.generation++; this.abort?.abort(); clearInterval(this.timer); this.capture?.cancel(); this.capture = null; this.stopping = false; this.publish({ phase: 'idle', elapsedMs: 0, level: 0 }); }
}
