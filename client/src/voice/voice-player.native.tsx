import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { voiceTime } from './voice-contract';
import { pauseVoicePlayback, registerVoicePlayer } from './playback-registry';
import { serif } from '../storybook/theme';
export function VoicePlayer({ uri, durationMs, label = 'Voice letter' }: { uri: string; durationMs: number; label?: string }) {
  const player = useAudioPlayer({ uri }, { updateInterval: 250 }); const state = useAudioPlayerStatus(player); const [error, setError] = useState<string | null>(null);
  useEffect(() => registerVoicePlayer(() => player.pause()), [player]);
  const play = async () => { setError(null); try {
    if (state.playing) player.pause(); else { pauseVoicePlayback(); await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldPlayInBackground: false, interruptionMode: 'doNotMix' }); if (state.didJustFinish) await player.seekTo(0); player.play(); }
  } catch { setError('The recording could not be played. Reopen it and try again.'); } };
  return <View style={styles.player}><Text style={styles.label}>{label}</Text><Text style={styles.time}>{voiceTime((state.currentTime ?? 0) * 1000)} / {voiceTime(durationMs)}</Text>
    <View style={styles.buttons}><Pressable accessibilityRole="button" accessibilityLabel="Restart voice letter" onPress={() => { void player.seekTo(0).catch(() => setError('This recording could not be restarted.')); }} style={styles.secondary}><Text style={styles.label}>↶</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={state.playing ? 'Pause voice letter' : 'Play voice letter'} onPress={() => { void play(); }} disabled={!state.isLoaded} style={styles.play}><Text style={styles.playText}>{state.playing ? 'Ⅱ' : '▶'}</Text></Pressable></View>
    {!state.isLoaded && !state.error && <Text style={styles.time}>Opening your recording…</Text>}
    {Boolean(error || state.error) && <Text role="alert" style={styles.error}>{error ?? 'This recording is unavailable. Reopen the letter to refresh it.'}</Text>}
  </View>;
}
const styles = StyleSheet.create({ player: { gap: 12, alignItems: 'center', padding: 18, width: '100%', borderColor: '#B89A65', borderWidth: 1, backgroundColor: '#E8D7B2', borderRadius: 5 }, label: { fontFamily: serif, fontSize: 19, color: '#59442D' }, time: { fontSize: 12, color: '#796443' }, buttons: { flexDirection: 'row', gap: 14 }, play: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6B543B', alignItems: 'center', justifyContent: 'center' }, playText: { color: '#F8EDCE', fontSize: 20 }, secondary: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, error: { fontSize: 12, color: '#8C4334', lineHeight: 18 } });
