import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { voiceTime } from './voice-contract';
import { serif } from '../storybook/theme';
import { pauseVoicePlayback, registerVoicePlayer } from './playback-registry';
export function VoicePlayer({ uri, durationMs, label = 'Voice letter' }: { uri: string; durationMs: number; label?: string }) {
  const player = useRef<HTMLAudioElement>(null); const [playing, setPlaying] = useState(false); const [position, setPosition] = useState(0); const [error, setError] = useState<string | null>(null);
  useEffect(() => { const node = player.current; const remove = registerVoicePlayer(() => node?.pause()); return () => { remove(); node?.pause(); }; }, [uri]);
  const toggle = async () => { const node = player.current; if (!node) return; setError(null); try { if (node.paused) { pauseVoicePlayback(); await node.play(); } else node.pause(); } catch { setError('This recording could not be played. Reopen it and try again.'); } };
  return <View style={styles.player}>
    <audio ref={player} src={uri} preload="metadata" aria-label={label} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={() => setPosition((player.current?.currentTime ?? 0) * 1000)} onError={() => setError('This recording is unavailable. Reopen the letter to refresh it.')} />
    <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause voice letter' : 'Play voice letter'} onPress={() => { void toggle(); }} style={styles.button}><Text style={styles.buttonText}>{playing ? 'Ⅱ' : '▶'}</Text></Pressable>
    <View style={{ flex: 1, gap: 7 }}><Text style={styles.label}>{label}</Text><input aria-label="Voice playback position" type="range" min={0} max={durationMs} value={Math.min(position, durationMs)} onChange={event => { const ms = Number(event.target.value); try { if (player.current) player.current.currentTime = ms / 1000; setPosition(ms); } catch { setError('Seeking is not available for this recording yet.'); } }} style={{ width: '100%', accentColor: '#8E6D39' }} /><Text style={styles.time}>{voiceTime(position)} / {voiceTime(durationMs)}</Text>{error && <Text role="alert" style={styles.error}>{error}</Text>}</View>
  </View>;
}
const styles = StyleSheet.create({ player: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderColor: '#B89A65', borderWidth: 1, backgroundColor: '#E8D7B2', borderRadius: 5, width: '100%' }, button: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#6B543B', alignItems: 'center', justifyContent: 'center' }, buttonText: { color: '#F8EDCE', fontSize: 19 }, label: { fontFamily: serif, color: '#59442D', fontSize: 18 }, time: { color: '#725F41', fontSize: 11 }, error: { color: '#8C4334', fontSize: 12, lineHeight: 18 } });
