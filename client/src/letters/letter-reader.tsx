import { watchPalaceEvents } from '../realtime/palace-live-state';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import type { FriendPerson, LetterEnvelope, OpenedFriendLetter } from '@lantern-post/shared-types';
import { StoryButton, StoryDialog, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { useMotionPreference } from '../storybook/use-reduced-motion';
import { ink, mutedInk, serif } from '../storybook/theme';
import { EnvelopeArt } from './envelope-art';
import { PaperFrame, stationeryFont } from './stationery';
import type { LetterBoxTransport } from './friend-letter-api';
import { VoicePlayer } from '../voice/voice-player';
import { VoiceCaption } from '../voice/voice-caption';
import type { SafetyTransport } from '../safety/safety-api';
import { BlockPalaceDialog, ReportLetterDialog } from '../safety/safety-controls';
import { pauseVoicePlayback } from '../voice/playback-registry';
import { usePalaceBell } from '../notifications/bell-context';

export function LetterReader({ item, api, onBack, onChanged, onReply, ownerId, safety }: { item: LetterEnvelope; api: LetterBoxTransport; onBack: () => void; onChanged: () => void; onReply?: (person: FriendPerson) => void; ownerId?: string; safety?: SafetyTransport }) {
  const bell = usePalaceBell();
  const [letter, setLetter] = useState<OpenedFriendLetter | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [removing, setRemoving] = useState(false);
  const [reporting, setReporting] = useState(false); const [blocking, setBlocking] = useState(false);
  useEffect(()=>ownerId?watchPalaceEvents(ownerId,event=>{if(event.kind==='GATES_CHANGED'||event.kind==='LETTER_REMOVED'&&event.itemId===item.id){pauseVoicePlayback();setLetter(null);onBack();}}):undefined,[ownerId,item.id,onBack]);
  const active = useRef(true); const request = useRef<AbortController | null>(null);
  useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);
  async function open() {
    if (busy) return; setBusy(true); setError(null); const abort = new AbortController(); request.current = abort;
    try { const result = await api.open(item.id, abort.signal); if (!active.current) return; setLetter(result); bell?.markItemSeen(item.id); onChanged(); }
    catch { if (active.current) setError('This letter could not be opened. It may have been removed, or your connection may be resting.'); }
    finally { if (active.current) setBusy(false); }
  }
  async function remove() {
    if (busy) return; setBusy(true); setError(null);
    try { await api.remove(item.id); if (!active.current) return; setLetter(null); onChanged(); onBack(); }
    catch { if (active.current) { setRemoving(false); setError('We could not confirm that the letter was removed. Return to your letterbox and refresh before trying again.'); } }
    finally { if (active.current) setBusy(false); }
  }
  const who = letter ?? item;
  return <StoryShell chapter="A LETTER, HELD WITH CARE" actions={<TextAction label="My letterbox" onPress={onBack} />}>
    <StoryHeading eyebrow={who.direction === 'received' ? 'CARRIED TO YOUR PALACE' : 'FROM YOUR WRITING DESK'} title={who.direction === 'received' ? `A letter from ${who.person.username}.` : `Your letter to ${who.person.username}.`} subtitle="A little paper. A little courage. A moment to listen." />
    {letter ? <OpenedPaper letter={letter} /> : <View style={styles.sealed}><EnvelopeArt preset={item.preset} width={250} /><Text style={styles.caption}>The words are waiting beneath the wax.</Text><StoryButton label={busy ? 'Opening the letter…' : 'Break the seal'} onPress={() => { void open(); }} busy={busy} /></View>}
    {error && <View style={styles.errorBox}><Text role="alert" style={styles.error}>{error}</Text>{!letter && <TextAction label="Try opening again" onPress={() => { void open(); }} disabled={busy} />}</View>}
    {letter && <View style={styles.actions}>
      {letter.direction === 'received' && onReply && <StoryButton label={`Write back to ${letter.person.username}`} onPress={() => onReply(letter.person)} />}
      <TextAction label="Return to my letterbox" onPress={onBack} /><TextAction label="Remove this letter" onPress={() => setRemoving(true)} />
      {safety && ownerId && <>{letter.direction === 'received' && <TextAction label="Report this letter" onPress={() => { pauseVoicePlayback(); setReporting(true); }} />}<TextAction label={`Block ${letter.person.username}`} onPress={() => { pauseVoicePlayback(); setBlocking(true); }} /></>}
    </View>}
    {removing && <StoryDialog title="Let this letter go?" onClose={() => { if (!busy) setRemoving(false); }}><Text style={s.body}>This removes the letter from your letterbox. Your friend keeps their copy. You will no longer be able to open it here.</Text><StoryButton label={busy ? 'Putting the letter away…' : 'Remove from my letterbox'} onPress={() => { void remove(); }} busy={busy} /><StoryButton label="Keep this letter" secondary onPress={() => setRemoving(false)} disabled={busy} /></StoryDialog>}
    {reporting && safety && ownerId && <ReportLetterDialog ownerId={ownerId} letterId={item.id} sender={item.person} api={safety} onClose={() => setReporting(false)} onBlocked={() => { setLetter(null); onChanged(); onBack(); }} />}
    {blocking && safety && ownerId && <BlockPalaceDialog ownerId={ownerId} person={item.person} api={safety} onClose={() => setBlocking(false)} onSaved={() => { setLetter(null); onChanged(); onBack(); }} />}
  </StoryShell>;
}
function OpenedPaper({ letter }: { letter: OpenedFriendLetter }) {
  const { ready, reduced } = useMotionPreference(); const [unfold] = useState(() => new Animated.Value(0));
  useEffect(() => { if (!ready) return; const animation = Animated.timing(unfold, { toValue: 1, duration: reduced ? 0 : 650, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }); animation.start(); return () => animation.stop(); }, [ready, reduced, unfold]);
  return <Animated.View testID="opened-friend-letter" style={[styles.paper, { opacity: unfold, transform: [{ translateY: unfold.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
    <PaperFrame preset={letter.preset}><Text style={styles.postmark}>{letter.direction === 'received' ? 'FROM' : 'TO'} @{letter.person.username} · {new Date(letter.deliveredAt).toLocaleDateString()}</Text>{letter.type === 'VOICE' && letter.audio ? <View style={{ paddingVertical: 25 }}><VoicePlayer uri={letter.audio.url} durationMs={letter.audio.durationMs} label="A voice, carried to your gate" /><VoiceCaption text={letter.audio.caption} /></View> : <Text selectable style={[styles.words, stationeryFont(letter.preset.config), { color: letter.preset.config.inkColor }]}>{letter.textContent}</Text>}<Text style={styles.signature}>Carried with a little light.</Text></PaperFrame>
  </Animated.View>;
}
const styles = StyleSheet.create({
  sealed: { paddingVertical: 42, gap: 27, alignItems: 'center' }, caption: { color: mutedInk, fontFamily: serif, fontStyle: 'italic', fontSize: 18, textAlign: 'center' },
  paper: { maxWidth: 790, width: '100%', alignSelf: 'center' }, words: { fontSize: 20, lineHeight: 34, minHeight: 220 }, postmark: { color: '#786744', fontSize: 10, lineHeight: 18, letterSpacing: 1.2, marginBottom: 25 }, signature: { fontFamily: serif, fontStyle: 'italic', fontSize: 16, color: '#887553', marginTop: 30 },
  actions: { alignItems: 'center', gap: 13, paddingTop: 24 }, errorBox: { alignSelf: 'center', maxWidth: 650, padding: 17, borderColor: '#C9AA86', borderWidth: 1, backgroundColor: '#F5E9D5', gap: 7 }, error: { color: '#874D38', lineHeight: 23, fontSize: 13 }, title: { fontFamily: serif, color: ink },
});
