export interface PlaybackStatus { isLoaded: boolean; currentTime: number; duration?: number; playbackState?: string; didJustFinish?: boolean; error?: unknown }
export interface PlaybackPort {
  pause(): void; play(): void; seekTo(seconds: number): Promise<void>;
  reload?(): void; status?(): PlaybackStatus;
}
export function playbackHasEnded(status: PlaybackStatus): boolean {
  return Boolean(status.didJustFinish || status.playbackState === 'ended' || (status.duration && status.duration > 0 && status.currentTime >= status.duration));
}
export async function startVoicePlayback(player: PlaybackPort, configure: () => Promise<void>, current: () => boolean, restart: boolean) {
  player.pause();
  await configure();
  if (!current()) return;
  if (restart && player.reload && player.status) {
    // Reopen the same source to reset an ended/unready native player. A seek
    // acknowledgment alone does not establish that playback can restart.
    player.reload();
    const until = Date.now() + 7500;
    while (current()) {
      const state = player.status();
      if (state.error) throw Error('Recording unavailable');
      if (state.isLoaded && Number.isFinite(state.currentTime) && state.currentTime <= .1 && state.playbackState !== 'ended') break;
      if (Date.now() >= until) throw Error('Recording reload timed out');
      await new Promise<void>(resolve => setTimeout(resolve, 50));
    }
  } else if (restart) await player.seekTo(0);
  if (current()) player.play();
}
