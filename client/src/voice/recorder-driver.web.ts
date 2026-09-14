import type { VoiceRecorderDriver } from './voice-contract';
import { MAX_VOICE_BYTES, MAX_VOICE_MS } from './voice-contract';
export const recorderDriver: VoiceRecorderDriver = {
  available: () => typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
  async start(onMeter, onEnded, signal) {
    const mime = ['audio/webm;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error('Voice recording is not supported in this browser.');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
    if (signal?.aborted) { stream.getTracks().forEach(track => track.stop()); throw new Error('Recording cancelled.'); }
    let cancelled = false; let bytes = 0; const chunks: Blob[] = []; const started = performance.now();
    let context: AudioContext | null = null; let meter: ReturnType<typeof setInterval> | undefined;
    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 64000 }); }
    catch { stream.getTracks().forEach(track => track.stop()); throw new Error('The microphone could not be started.'); }
    try {
      context = new AudioContext(); const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser(); analyser.fftSize = 256; source.connect(analyser);
      const samples = new Uint8Array(analyser.fftSize);
      meter = setInterval(() => { analyser.getByteTimeDomainData(samples); const energy = samples.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / samples.length; onMeter(Math.min(1, Math.sqrt(energy) * 4)); }, 100);
    } catch { /* Recording still works when the optional level meter is unavailable. */ }
    let resolveResult: (value: { bytes: Uint8Array; mimeType: 'audio/webm' | 'audio/mp4'; durationMs: number }) => void = () => {};
    let rejectResult: (error: Error) => void = () => {};
    const result = new Promise<{ bytes: Uint8Array; mimeType: 'audio/webm' | 'audio/mp4'; durationMs: number }>((resolve, reject) => { resolveResult = resolve; rejectResult = reject; });
    // A disposed recorder may reject without anyone awaiting stop().
    void result.catch(() => {});
    const release = () => { clearInterval(meter); clearTimeout(limit); stream.getTracks().forEach(track => { track.onended = null; track.stop(); }); void context?.close().catch(() => {}); onMeter(0); };
    const stop = () => { if (recorder.state !== 'inactive') recorder.stop(); };
    const limit = setTimeout(stop, MAX_VOICE_MS - 500);
    recorder.ondataavailable = event => { if (event.data.size && !cancelled) { chunks.push(event.data); bytes += event.data.size; if (bytes > MAX_VOICE_BYTES) stop(); } };
    recorder.onerror = () => { cancelled = true; release(); rejectResult(new Error('The microphone recording was interrupted.')); onEnded(); };
    recorder.onstop = () => {
      const durationMs = Math.min(MAX_VOICE_MS, Math.round(performance.now() - started)); release();
      if (cancelled || bytes < 64 || bytes > MAX_VOICE_BYTES || durationMs < 1000) { rejectResult(new Error(cancelled ? 'Recording cancelled.' : 'Record between one second and three minutes.')); onEnded(); return; }
      const blob = new Blob(chunks, { type: mime.split(';')[0] });
      void blob.arrayBuffer().then(buffer => resolveResult({ bytes: new Uint8Array(buffer), mimeType: mime.startsWith('audio/webm') ? 'audio/webm' : 'audio/mp4', durationMs })).catch(() => rejectResult(new Error('The recording could not be read.')));
      onEnded();
    };
    stream.getAudioTracks().forEach(track => { track.onended = stop; });
    try { recorder.start(1000); } catch { release(); throw new Error('The microphone could not be started.'); }
    return { stop: async () => { stop(); return result; }, cancel: () => { cancelled = true; stop(); release(); } };
  },
};
