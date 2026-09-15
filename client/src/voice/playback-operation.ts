export interface PlaybackPort { pause(): void; play(): void; seekTo(seconds: number): Promise<void> }
export async function startVoicePlayback(player: PlaybackPort, configure: () => Promise<void>, current: () => boolean, restart: boolean) {
  player.pause();
  await configure();
  if (!current()) return;
  if (restart) await player.seekTo(0);
  if (current()) player.play();
}
