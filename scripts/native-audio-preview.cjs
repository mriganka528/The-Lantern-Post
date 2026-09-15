// Test-only bridge for exercising the actual native player component in the
// browser harness. This does not record, play audio or verify physical hardware.
const React = require('react');
let state = { isLoaded: false, currentTime: 2.9, duration: 3, playing: false, playbackState: 'ended', didJustFinish: false };
let plays = 0, reloads = 0;
const listeners = new Set();
const publish = patch => { state = { ...state, ...patch }; for (const listener of listeners) listener(); };
const player = {
  get currentStatus() { return state; },
  pause() { publish({ playing: false }); },
  play() { if (!state.isLoaded || state.currentTime !== 0) throw Error('Source was not reset'); plays++; publish({ playing: true }); },
  async seekTo() { throw Error('Native restart must prepare its source'); },
  replace() {
    reloads++; publish({ isLoaded: false, playbackState: 'loading' });
    setTimeout(() => publish({ isLoaded: true, currentTime: 0, playbackState: 'readyToPlay' }), 40);
  },
};
exports.useAudioPlayer = () => player;
exports.useAudioPlayerStatus = () => React.useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => state);
exports.setAudioModeAsync = async () => {};
window.__audioPreview = {
  counts: () => ({ plays, reloads }),
  end: () => publish({ playing: false, isLoaded: true, currentTime: 2.9, playbackState: 'ended', didJustFinish: false }),
};
