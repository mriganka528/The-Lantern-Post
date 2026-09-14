import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { WorldLetter } from '@lantern-post/shared-types';
import { PaperFrame, stationeryFont } from '../letters/stationery';
import { StoryButton, StoryDialog, s, TextAction } from '../storybook/story-ui';
import { serif } from '../storybook/theme';
import { VoicePlayer } from '../voice/voice-player';
import { VoiceCaption } from '../voice/voice-caption';
import { pauseVoicePlayback } from '../voice/playback-registry';
import { BlockPalaceDialog, ReportLetterDialog } from '../safety/safety-controls';
import type { SafetyTransport } from '../safety/safety-api';
import type { InfinityTransport } from './infinity-api';
import { sampleStars } from './sample-stars';
import { ApiError, ApiTimeoutError, requestErrorMessage } from '../api/client';
export function WorldReader({ id, ownerId, api, safety, preview, onClose, onChanged }: { id: string; ownerId: string; api: InfinityTransport; safety: SafetyTransport; preview: boolean; onClose: () => void; onChanged: () => void }) {
  const transport = useRef(api);
  useEffect(() => { transport.current = api; }, [api]);
  const [letter, setLetter] = useState<WorldLetter | null>(() => preview ? sampleStars.find(star => star.id === id) ?? null : null);
  const [error, setError] = useState<string | null>(null); const [retry, setRetry] = useState(0); const [action, setAction] = useState<'report' | 'block' | 'remove' | null>(null); const [busy, setBusy] = useState(false); const [removeError, setRemoveError] = useState(false);
  useEffect(() => { if (preview) return; let active = true; const abort = new AbortController();
    void transport.current.open(id, abort.signal).then(value => { if (!value || value.id !== id) throw new Error('The letter response was incomplete.'); if (active) setLetter(value); }).catch(failure => { if (active) setError(failure instanceof ApiTimeoutError ? 'This light is taking longer to arrive. Please try opening it again.' : failure instanceof ApiError && failure.status === 404 ? 'This light is no longer available. It may have been removed.' : requestErrorMessage(failure)); });
    return () => { active = false; abort.abort(); pauseVoicePlayback(); };
  // Refreshing a same-account token/transport must not cancel and restart an
  // opening letter. A new letter, account, or explicit retry starts a new read.
  }, [ownerId, id, preview, retry]);
  const close = () => { if (!busy) { pauseVoicePlayback(); onClose(); } };
  const removed = () => { setLetter(null); pauseVoicePlayback(); onChanged(); onClose(); };
  return <>
    <StoryDialog title={preview ? 'A storybook sample' : letter?.signature ? `A letter from ${letter.signature}` : 'A letter, without a name'} onClose={close}>
      {preview && <Text style={styles.preview}>PREVIEW LETTER · NOT A COMMUNITY MESSAGE</Text>}
      {!letter ? error ? <><Text role="alert" style={s.body}>{error}</Text><StoryButton label="Try opening this light again" onPress={() => { setError(null); setRetry(value => value + 1); }} /></> : <View accessibilityLiveRegion="polite" style={{ alignItems: 'center', gap: 12 }}><ActivityIndicator color="#A18B60" /><Text style={s.body}>Opening this little light…</Text></View> : <>
        <PaperFrame preset={letter.preset}><Text style={styles.heading}>{preview ? 'FROM THE STORYBOOK COLLECTION' : letter.signature ? `SIGNED BY @${letter.signature}` : 'LEFT WITHOUT A NAME'}</Text>
          {letter.type === 'VOICE' && letter.audio ? <View style={{ paddingVertical: 20 }}><VoicePlayer uri={letter.audio.url} durationMs={letter.audio.durationMs} label="A voice among the stars" /><VoiceCaption text={letter.audio.caption} /></View> : <Text selectable style={[styles.words, stationeryFont(letter.preset.config), { color: letter.preset.config.inkColor }]}>{letter.textContent}</Text>}
          <Text style={styles.footer}>Carried into the quiet sky.</Text>
        </PaperFrame>
        {!preview && <><Text style={styles.date}>{new Date(letter.deliveredAt).toLocaleDateString()}</Text>{letter.mine ? <TextAction label="Remove my light from the world" onPress={() => setAction('remove')} /> : <><TextAction label="Report this public letter" onPress={() => { pauseVoicePlayback(); setAction('report'); }} /><TextAction label="Block this letter's author" onPress={() => { pauseVoicePlayback(); setAction('block'); }} /></>}</>}
      </>}
      <TextAction label="Return to the stars" onPress={close} disabled={busy} />
    </StoryDialog>
    {action === 'report' && letter && <ReportLetterDialog ownerId={ownerId} letterId={id} sender={{ username: letter.signature }} api={safety} onClose={() => setAction(null)} onBlocked={removed} />}
    {action === 'block' && letter && <BlockPalaceDialog ownerId={ownerId} person={{ id, username: letter.signature }} api={{ ...safety, block: value => api.block(value) }} onClose={() => setAction(null)} onSaved={removed} />}
    {action === 'remove' && <StoryDialog title="Take this light out of the sky?" onClose={() => { if (!busy) setAction(null); }}><Text style={s.body}>Your letter will no longer be available to open. Copies someone already kept cannot be recalled.</Text>{removeError && <Text role="alert" style={s.body}>Removal was not confirmed. You can retry safely.</Text>}<StoryButton label={busy ? 'Taking your light home…' : 'Remove my public letter'} busy={busy} onPress={() => { if (busy) return; setBusy(true); setRemoveError(false); void api.remove(id).then(removed).catch(() => setRemoveError(true)).finally(() => setBusy(false)); }} /><StoryButton label="Leave my light here" secondary disabled={busy} onPress={() => setAction(null)} /></StoryDialog>}
  </>;
}
const styles = StyleSheet.create({ preview: { color: '#75664D', fontSize: 9, letterSpacing: 1, lineHeight: 18, textAlign: 'center' }, heading: { color: '#927B53', fontSize: 9, lineHeight: 17, letterSpacing: 1.2, marginBottom: 20 }, words: { fontSize: 18, lineHeight: 30 }, footer: { color: '#927F60', fontFamily: serif, fontSize: 15, fontStyle: 'italic', marginTop: 28 }, date: { color: '#8B7C63', fontSize: 11, textAlign: 'center' } });
