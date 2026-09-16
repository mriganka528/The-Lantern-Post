import { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { voiceTime } from './voice-contract';
import { pauseVoicePlayback, registerVoicePlayer } from './playback-registry';
import { serif } from '../storybook/theme';
import { playbackHasEnded, startVoicePlayback } from './playback-operation';
import { PlayFromStartButton, RemoveAudioButton } from './voice-playback-controls';
import type { VoicePlayerProps } from './voice-playback-controls';
export function VoicePlayer({ uri, durationMs, label = 'Voice letter', onRemove, removeDisabled }: VoicePlayerProps) {
  const player = useAudioPlayer({ uri }, { updateInterval: 250 }); const state = useAudioPlayerStatus(player); const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const generation = useRef(0), running = useRef(false), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const stop = () => { generation.current++; running.current = false; try { player.pause(); } catch { /* A released player is already silent. */ } if (mounted.current) setBusy(false); };
    const unregister = registerVoicePlayer(stop);
    const subscription = AppState.addEventListener('change', value => { if (value !== 'active') stop(); });
    return () => { mounted.current = false; unregister(); subscription.remove(); stop(); };
  }, [player]);
  const play = async (restart = false) => {
    if (running.current || AppState.currentState !== 'active') return;
    setError(null);
    if (state.playing && !restart) { generation.current++; player.pause(); return; }
    pauseVoicePlayback();
    const attempt = ++generation.current; const current = () => mounted.current && attempt === generation.current && AppState.currentState === 'active';
    running.current = true; setBusy(true);
    const timer = setTimeout(() => { if (current()) { generation.current++; running.current = false; setBusy(false); player.pause(); setError('The recording took too long to restart. Please try again.'); } }, 8000);
    try {
      await startVoicePlayback({
        pause: () => player.pause(), play: () => player.play(), seekTo: seconds => player.seekTo(seconds),
        reload: () => player.replace({ uri }), status: () => player.currentStatus,
      }, () => setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' }), current, restart || playbackHasEnded(player.currentStatus));
    } catch { if (current()) setError('The recording could not be played. Please try again.'); }
    finally { clearTimeout(timer); if (current()) { running.current = false; setBusy(false); } }
  };
  return <View style={styles.player}><Text style={styles.label}>{label}</Text><Text style={styles.time}>{voiceTime((state.currentTime ?? 0) * 1000)} / {voiceTime(durationMs)}</Text>
    <View style={styles.buttons}><PlayFromStartButton onPress={() => { void play(true); }} disabled={busy} /><Pressable accessibilityRole="button" accessibilityLabel={state.playing ? 'Pause voice letter' : 'Play voice letter'} onPress={() => { void play(); }} disabled={busy || (!state.isLoaded && !state.playing)} style={styles.play}><Text style={styles.playText}>{state.playing ? 'Ⅱ' : '▶'}</Text></Pressable>{onRemove && <RemoveAudioButton onPress={onRemove} disabled={removeDisabled || busy} />}</View>
    {busy ? <Text style={styles.time}>Preparing playback…</Text> : !state.isLoaded && !state.error && <Text style={styles.time}>{state.isBuffering ? 'Buffering your recording…' : 'Opening your recording…'}</Text>}
    {Boolean(error || state.error) && <Text role="alert" style={styles.error}>{error ?? 'This recording is unavailable. Reopen the letter to refresh it.'}</Text>}
  </View>;
}
const styles = StyleSheet.create({ player: { gap: 12, alignItems: 'center', padding: 18, width: '100%', borderColor: '#B89A65', borderWidth: 1, backgroundColor: '#E8D7B2', borderRadius: 5 }, label: { fontFamily: serif, fontSize: 19, color: '#59442D' }, time: { fontSize: 12, color: '#796443' }, buttons: { flexDirection: 'row', gap: 8, maxWidth: '100%', alignItems: 'center', justifyContent: 'center' }, play: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6B543B', alignItems: 'center', justifyContent: 'center' }, playText: { color: '#F8EDCE', fontSize: 20 }, error: { fontSize: 12, color: '#8C4334', lineHeight: 18 } });
