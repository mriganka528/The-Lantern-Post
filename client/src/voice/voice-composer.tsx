import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Text, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { VoiceClip } from '@lantern-post/shared-types';
import type { DraftController } from '../letters/draft';
import { StoryButton, StoryDialog, s } from '../storybook/story-ui';
import { serif } from '../storybook/theme';
import { RecorderController } from './recorder-controller';
import { recorderDriver } from './recorder-driver';
import { voiceStorage } from './voice-storage';
import { VoicePlayer } from './voice-player';
import { voiceTime } from './voice-contract';
import { VoiceCaption } from './voice-caption';
import { RemoveAudioButton } from './voice-playback-controls';
import type { VoicePlayerProps } from './voice-playback-controls';
import { pauseVoicePlayback } from './playback-registry';

type RemovalProps = Pick<VoicePlayerProps, 'onRemove' | 'removeDisabled'>;
export function LocalVoicePlayer({ ownerId, clip, caption, onRemove, removeDisabled }: { ownerId: string; clip: VoiceClip; caption?: string } & RemovalProps) {
  return <View style={{ width: '100%' }}><StoredVoicePlayer key={`${ownerId}:${clip.id}`} ownerId={ownerId} clip={clip} onRemove={onRemove} removeDisabled={removeDisabled} /><VoiceCaption text={caption} /></View>;
}
function StoredVoicePlayer({ ownerId, clip, onRemove, removeDisabled }: { ownerId: string; clip: VoiceClip } & RemovalProps) {
  const [source, setSource] = useState<string | null>(null); const [error, setError] = useState(false);
  const { id, mimeType, byteLength, durationMs } = clip;
  useEffect(() => { let active = true; let release: (() => void) | undefined;
    void voiceStorage.playback(ownerId, { id, mimeType, byteLength, durationMs }).then(result => { if (!active) result.release(); else { release = result.release; setSource(result.uri); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; release?.(); };
  }, [id, mimeType, byteLength, durationMs, ownerId]);
  return source && !error ? <VoicePlayer uri={source} durationMs={clip.durationMs} label="Your recording" onRemove={onRemove} removeDisabled={removeDisabled} /> : <View style={{ gap: 12, alignItems: 'center' }}>{error ? <Text role="alert" style={styles.error}>The saved recording is missing. Remove it and record a new take.</Text> : <Text style={s.body}>Finding your recording…</Text>}{onRemove && <RemoveAudioButton onPress={onRemove} disabled={removeDisabled} />}</View>;
}
export function VoiceComposer({ ownerId, draft, clip, caption, clearing, onBusy, onRecording }: { ownerId: string; draft: DraftController; clip: VoiceClip | null; caption: string; clearing: boolean; onBusy: (busy: boolean) => void; onRecording?: (recording: boolean) => void }) {
  const [recorder] = useState(() => new RecorderController(recorderDriver, voiceStorage, ownerId, value => draft.attachVoice(value), randomUUID));
  const state = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot, recorder.getSnapshot);
  const [discard, setDiscard] = useState(false); const busy = ['permission', 'recording', 'saving'].includes(state.phase);
  const [removeError, setRemoveError] = useState(false);
  useEffect(() => { onBusy(busy); }, [busy, onBusy]);
  useEffect(() => { onRecording?.(state.phase === 'recording'); return () => onRecording?.(false); }, [onRecording, state.phase]);
  useEffect(() => { const listener = AppState.addEventListener('change', value => { if (value === 'background') recorder.background(); else if (value !== 'active') void recorder.stop(); }); return () => { listener.remove(); recorder.dispose(); onBusy(false); }; }, [onBusy, recorder]);
  return <View style={styles.composer}>
    <View style={styles.gramophone}><View style={styles.horn} /><View style={styles.stem} /><View style={styles.base}><Text style={styles.monogram}>LP</Text></View></View>
    <Text style={styles.title}>A voice, kept with care.</Text><Text style={styles.body}>A little message in your own voice. Up to three minutes, held here until you choose its path.</Text>
    {clip ? <><LocalVoicePlayer ownerId={ownerId} clip={clip} onRemove={() => { pauseVoicePlayback(); setRemoveError(false); setDiscard(true); }} removeDisabled={clearing || busy} /><Text style={styles.body}>Add words for someone who would rather read or cannot listen.</Text><TextInput accessibilityLabel="Words to read with your voice, optional" placeholder="Your written version (optional)" placeholderTextColor="#978466" value={caption} onChangeText={value => draft.editVoiceCaption(value)} multiline maxLength={2000} editable={!busy && !clearing} style={{ width: '100%', minHeight: 110, borderColor: '#BCA67A', borderWidth: 1, padding: 14, color: '#58462F', fontSize: 16, lineHeight: 25, backgroundColor: '#F8EAC8', textAlignVertical: 'top' }} /></> : <>
      <View style={styles.meter}><View style={[styles.level, { width: `${Math.round(state.level * 100)}%` }]} /></View>
      <Text accessibilityLiveRegion="polite" style={styles.timer}>{voiceTime(state.elapsedMs)} / 3:00</Text>
      {state.phase === 'recording' ? <StoryButton label="Stop recording" onPress={() => { void recorder.stop(); }} /> : <StoryButton label={state.phase === 'permission' ? 'Waiting for your microphone…' : state.phase === 'saving' ? 'Keeping your recording…' : 'Record my voice'} onPress={() => { void recorder.start(); }} disabled={busy || clearing || !recorderDriver.available()} />}
      {!recorderDriver.available() && <Text style={styles.body}>Recording is unavailable in this build. You can use the browser version or write a text letter.</Text>}
    </>}
    {state.error && <Text role="alert" style={styles.error}>{state.error}</Text>}
    {discard && <StoryDialog title="Remove this recording?" onClose={() => setDiscard(false)} footer={<><StoryButton label="Remove recording" onPress={() => { if (draft.discardVoice()) setDiscard(false); else setRemoveError(true); }} disabled={clearing} /><StoryButton label="Keep recording" secondary onPress={() => setDiscard(false)} /></>}><Text style={s.body}>This removes the recording and its written version from this letter. You can record a fresh take afterward.</Text>{removeError&&<Text role="alert" style={styles.error}>The recording could not be removed. Your original is kept; please try again.</Text>}</StoryDialog>}
  </View>;
}
const styles = StyleSheet.create({ composer: { alignItems: 'center', gap: 18, paddingVertical: 21 }, gramophone: { width: 160, height: 130, alignItems: 'center' }, horn: { width: 108, height: 66, borderTopLeftRadius: 70, borderBottomLeftRadius: 70, borderWidth: 6, borderColor: '#A88748', backgroundColor: '#D6BE7E', transform: [{ rotate: '-17deg' }], left: 18 }, stem: { position: 'absolute', left: 88, top: 50, width: 25, height: 47, borderRightWidth: 7, borderBottomWidth: 7, borderColor: '#A88748', borderBottomRightRadius: 23 }, base: { position: 'absolute', bottom: 0, width: 129, height: 45, borderRadius: 5, borderWidth: 3, borderColor: '#6B4B2E', backgroundColor: '#8D6842', alignItems: 'center', justifyContent: 'center' }, monogram: { fontFamily: serif, color: '#E1C991', fontSize: 19 }, title: { fontFamily: serif, fontSize: 27, color: '#59422E', textAlign: 'center' }, body: { color: '#786344', fontSize: 13, lineHeight: 23, textAlign: 'center' }, meter: { width: '90%', height: 8, borderRadius: 5, backgroundColor: '#DACAA4', overflow: 'hidden' }, level: { height: '100%', backgroundColor: '#A88748' }, timer: { fontFamily: serif, fontSize: 24, color: '#795B33' }, error: { color: '#8E4533', fontSize: 12, lineHeight: 21, textAlign: 'center' } });
