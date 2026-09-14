import type { VoiceRecorderDriver } from './voice-contract';
// The guarded native adapter is enabled when Expo Audio is installed.
export const recorderDriver: VoiceRecorderDriver = { available: () => false, start: async () => { throw new Error('Voice recording is unavailable in this build.'); } };
