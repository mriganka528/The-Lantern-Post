import { AppState, Platform } from 'react-native';
import { AudioModule, AudioQuality, IOSOutputFormat, getRecordingPermissionsAsync, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { File } from 'expo-file-system';
import { MAX_VOICE_BYTES, MAX_VOICE_MS } from './voice-contract';
import { createNativeRecorderDriver } from './native-recorder-session';
import { waitForNativeGoogleForeground } from '../auth/native-google-state';

export const recorderDriver = createNativeRecorderDriver({
  hasPermission: async () => (await getRecordingPermissionsAsync()).granted,
  requestPermission: async () => (await requestRecordingPermissionsAsync()).granted,
  isForeground: () => AppState.currentState === 'active',
  foreground: signal => waitForNativeGoogleForeground(() => AppState.currentState, listener => {
    const subscription = AppState.addEventListener('change', listener); return () => subscription.remove();
  }, signal),
  enableAudio: () => setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, shouldPlayInBackground: false, allowsBackgroundRecording: false, interruptionMode: 'doNotMix' }),
  disableAudio: () => setAudioModeAsync({ allowsRecording: false }),
  create() {
    // The native constructor takes flattened platform options; 44.1-kHz AAC
    // is widely supported by Android microphone encoders.
    const common = { extension: '.m4a', sampleRate: 44100, numberOfChannels: 1, bitRate: 64000, isMeteringEnabled: true, directory: 'cache' as const };
    const options = Platform.OS === 'ios' ? { ...common, outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM } : { ...common, outputFormat: 'mpeg4', audioEncoder: 'aac' };
    const nativeAudioModule = AudioModule;
    const recorder = new nativeAudioModule.AudioRecorder(options);
    return {
      prepare: () => recorder.prepareToRecordAsync(), record: () => recorder.record({ forDuration: (MAX_VOICE_MS - 500) / 1000 }),
      stop: () => recorder.stop(), release: () => recorder.release(), status: () => recorder.getStatus(), uri: () => recorder.uri,
      listen: callback => { const sub = recorder.addListener('recordingStatusUpdate', status => callback(status.isFinished || status.hasError, status.url)); return () => sub.remove(); },
    };
  },
  async read(uri) { const file = new File(uri); if (file.size < 64 || file.size > MAX_VOICE_BYTES) throw Error('Invalid recording size'); return file.bytes(); },
  remove(uri) { const file = new File(uri); if (file.exists) file.delete(); },
});
