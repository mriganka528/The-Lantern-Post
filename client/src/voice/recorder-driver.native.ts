import { Platform } from 'react-native';
import { AudioModule, AudioQuality, IOSOutputFormat, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import type { VoiceRecorderDriver, VoiceRecording } from './voice-contract';
import { MAX_VOICE_BYTES, MAX_VOICE_MS } from './voice-contract';

export const recorderDriver: VoiceRecorderDriver = {
  available: () => true,
  async start(onMeter, onEnded, signal) {
    const permission = await requestRecordingPermissionsAsync(); if (!permission.granted || signal?.aborted) throw new Error('Microphone permission is required.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, allowsBackgroundRecording: false, interruptionMode: 'doNotMix' });
    const common = { extension: '.m4a', sampleRate: 24000, numberOfChannels: 1, bitRate: 64000, isMeteringEnabled: true, directory: 'cache' as const };
    const options = Platform.OS === 'ios' ? { ...common, outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM } : { ...common, outputFormat: 'mpeg4', audioEncoder: 'aac' };
    // Expo's native module is an object with runtime-provided constructors.
    const nativeAudioModule = AudioModule;
    const recorder = new nativeAudioModule.AudioRecorder(options);
    let timer: ReturnType<typeof setInterval> | undefined; let released = false; let duration = 0; let uri: string | null = null; let result: Promise<VoiceRecording> | null = null;
    const subscription = recorder.addListener('recordingStatusUpdate', status => { if (status.url) uri = status.url; if (status.isFinished || status.hasError) onEnded(); });
    const release = () => { if (released) return; released = true; clearInterval(timer); subscription.remove(); recorder.release(); onMeter(0); void setAudioModeAsync({ allowsRecording: false }).catch(() => {}); };
    try {
      await recorder.prepareToRecordAsync(); if (signal?.aborted) throw new Error('Recording cancelled.');
      recorder.record({ forDuration: (MAX_VOICE_MS - 500) / 1000 });
      timer = setInterval(() => { const status = recorder.getStatus(); duration = Math.max(duration, status.durationMillis); if (status.url) uri = status.url; onMeter(status.metering === undefined ? 0 : Math.min(1, 10 ** (status.metering / 20) * 3)); }, 150);
    } catch { if (recorder.isRecording) await recorder.stop().catch(() => {}); release(); throw new Error('The microphone could not be started.'); }
    const stop = (): Promise<VoiceRecording> => {
      if (result) return result;
      result = (async () => {
        let file: File | null = null;
        try {
          duration = Math.max(duration, recorder.currentTime * 1000, recorder.getStatus().durationMillis);
          if (recorder.isRecording) await recorder.stop(); uri = recorder.uri ?? uri;
          if (!uri) throw new Error('No recording'); file = new File(uri);
          if (file.size < 64 || file.size > MAX_VOICE_BYTES) throw new Error('Invalid recording size');
          return { bytes: await file.bytes(), mimeType: 'audio/mp4' as const, durationMs: Math.min(MAX_VOICE_MS, Math.round(duration)) };
        } finally { try { if (file?.exists) file.delete(); } finally { release(); } }
      })();
      void result.catch(() => {}); return result;
    };
    return { stop, cancel: () => { if (!released) void stop().catch(() => {}); } };
  },
};
