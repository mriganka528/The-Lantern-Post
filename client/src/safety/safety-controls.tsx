import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { LetterReportReason } from '@lantern-post/shared-types';
import type { SafetyTransport } from './safety-api';
import { safetyError } from './safety-api';
import { StoryButton, StoryDialog, TextAction, s } from '../storybook/story-ui';
import { StoryIcon } from '../storybook/ornaments';
import { PalaceCrest } from '../letters/antique-assets';
import { serif } from '../storybook/theme';
import { pauseVoicePlayback } from '../voice/playback-registry';

export const safetyKey = (ownerId: string) => ['safety', ownerId] as const;
function useSafetyAction(ownerId: string) {
  const cache = useQueryClient(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const active = useRef(true); const running = useRef(false);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const run = useCallback(async (work: () => Promise<unknown>, complete: () => void) => {
    if (running.current) return; running.current = true; setBusy(true); setError(null);
    try { await work(); pauseVoicePlayback();
      await Promise.all([cache.resetQueries({ queryKey: ['friends', ownerId] }), cache.resetQueries({ queryKey: ['letterbox', ownerId] }), cache.resetQueries({ queryKey: ['infinity', ownerId] }), cache.invalidateQueries({ queryKey: safetyKey(ownerId) })]);
      if (active.current) complete();
    } catch (failure) { if (active.current) setError(safetyError(failure)); }
    finally { running.current = false; if (active.current) setBusy(false); }
  }, [cache, ownerId]);
  return { busy, error, run };
}
export function BlockPalaceDialog({ ownerId, person, api, onClose, onSaved, unblock = false }: { ownerId: string; person: { id: string; username: string | null }; api: SafetyTransport; onClose: () => void; onSaved: () => void; unblock?: boolean }) {
  const action = useSafetyAction(ownerId);
  const name = person.username ?? 'this unnamed palace';
  return <StoryDialog title={unblock ? `Unblock ${name}?` : `Close the gate to ${name}?`} onClose={() => { if (!action.busy) onClose(); }}>
    <View style={styles.emblem}><StoryIcon kind={unblock ? 'key' : 'gate'} size={42} /></View>
    <Text style={s.body}>{unblock ? 'They will be able to find your palace and send a new invitation. Your friendship and its letters stay closed until you both agree to be friends again.' : 'This blocks their palace, ends your friendship and hides the letters between you. Neither of you can send the other invitations or letters while either gate is blocked.'}</Text>
    {!unblock && <Text style={styles.small}>You can manage this later in My closed gates. This does not delete your own draft.</Text>}
    {action.error && <Text role="alert" style={styles.error}>{action.error}</Text>}
    <StoryButton label={action.busy ? 'Saving your choice…' : `${unblock ? 'Unblock' : 'Block'} ${name}`} busy={action.busy} onPress={() => { void action.run(() => unblock ? api.unblock(person.id) : api.block(person.id), onSaved); }} />
    <StoryButton label="Keep things as they are" secondary disabled={action.busy} onPress={onClose} />
  </StoryDialog>;
}
const reasons: { value: LetterReportReason; label: string }[] = [
  { value: 'HARASSMENT', label: 'Harassment or bullying' }, { value: 'SPAM', label: 'Spam or unwanted promotion' }, { value: 'HATE_SPEECH', label: 'Hate or discrimination' }, { value: 'SELF_HARM_CONCERN', label: 'Concern for someone’s safety' }, { value: 'OTHER', label: 'Something else' },
];
export function ReportLetterDialog({ ownerId, letterId, sender, api, onClose, onBlocked, item = 'letter' }: { ownerId: string; letterId: string; sender: { username: string | null }; api: SafetyTransport; onClose: () => void; onBlocked: () => void; item?: 'letter' | 'message' }) {
  const [reason, setReason] = useState<LetterReportReason | null>(null); const [detail, setDetail] = useState(''); const [block, setBlock] = useState(false); const [saved, setSaved] = useState(false);
  const action = useSafetyAction(ownerId);
  return <StoryDialog title={saved ? 'Your report has been saved.' : 'A ' + item + ' that needs care'} onClose={() => { if (!action.busy) { if (saved && block) onBlocked(); else onClose(); } }}>
    <View style={styles.emblem}><PalaceCrest size={44} /></View>
    {saved ? <><Text style={s.body}>Thank you for telling us. Your report is stored for review. We cannot promise an immediate response.</Text>{block && <Text style={s.body}>The gate to {sender.username ? `@${sender.username}` : 'this unnamed palace'} is now closed.</Text>}<StoryButton label={item === 'message' ? 'Return to the parlour' : 'Return to my letters'} onPress={block ? onBlocked : onClose} /></> : <>
      <Text style={s.body}>Tell us what concerned you about this {item}. Reporting alone does not delete it or close a friendship.</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Reason for reporting" style={{ gap: 7 }}>{reasons.map(item => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: reason === item.value, disabled: action.busy }} aria-checked={reason === item.value} disabled={action.busy} onPress={() => setReason(item.value)} style={[styles.reason, reason === item.value && styles.chosen]}><Text style={styles.body}>{item.label}</Text></Pressable>)}</View>
      <TextInput accessibilityLabel="Report details, optional" placeholder="Anything else you would like us to know (optional)" placeholderTextColor="#8C7A62" value={detail} onChangeText={setDetail} editable={!action.busy} multiline maxLength={item === 'message' ? 500 : 1000} style={styles.details} />
      <Pressable accessibilityRole="checkbox" accessibilityLabel={`Also block ${sender.username ?? 'this unnamed palace'}`} accessibilityState={{ checked: block, disabled: action.busy }} aria-checked={block} disabled={action.busy} onPress={() => setBlock(value => !value)} style={styles.checkbox}><Text style={styles.body}>{block ? '☑' : '☐'}  Also block {sender.username ? `@${sender.username}` : 'this unnamed palace'}</Text></Pressable>
      {block && <Text style={styles.small}>This ends the friendship and hides your shared letters. Unblocking will require a new accepted invitation.</Text>}
      {reason === 'SELF_HARM_CONCERN' && <Text style={styles.small}>Reports are not an emergency service. If someone is in immediate danger, contact local emergency services or someone nearby who can help.</Text>}
      {action.error && <Text role="alert" style={styles.error}>{action.error}</Text>}
      <StoryButton label={action.busy ? 'Saving your report…' : block ? 'Save report and block sender' : 'Save my report'} busy={action.busy} disabled={!reason} onPress={() => { if (reason) void action.run(() => api.report(letterId, { reason, detail: detail.trim() || undefined, blockSender: block, confirmed: true }), () => setSaved(true)); }} />
      <TextAction label="Keep reading" disabled={action.busy} onPress={onClose} />
    </>}
  </StoryDialog>;
}
export function ClosedGates({ ownerId, api }: { ownerId: string; api: SafetyTransport }) {
  const [open, setOpen] = useState(false); const [selected, setSelected] = useState<{ id: string; username: string | null } | null>(null);
  const list = useInfiniteQuery({ queryKey: [...safetyKey(ownerId), 'blocks'], initialPageParam: null as string | null, queryFn: ({ pageParam, signal }) => api.blocked(pageParam, signal), getNextPageParam: page => page.nextCursor, enabled: open, staleTime: 0 });
  const entries = list.data?.pages.flatMap(page => page.items) ?? [];
  return <View style={styles.panel}><View style={styles.panelTop}><StoryIcon kind="gate" size={29} /><Text style={styles.title}>A little peace at your gate</Text></View><Text style={styles.body}>Choose which palaces may reach yours.</Text><TextAction label={open ? 'Hide my closed gates' : 'My closed gates'} onPress={() => setOpen(value => !value)} />
    {open && <>{list.isPending ? <ActivityIndicator color="#92754B" /> : list.isError ? <><Text role="alert" style={styles.error}>{safetyError(list.error)}</Text><TextAction label="Refresh closed gates" onPress={() => { void list.refetch(); }} /></> : <>
      {!entries.length && <Text style={styles.body}>You haven’t blocked any palaces.</Text>}
      {entries.map(entry => <View key={entry.id} style={styles.row}><Text style={styles.name}>{entry.username ? `@${entry.username}` : 'An unnamed palace'}</Text><TextAction label={`Unblock ${entry.username ?? 'this unnamed palace'}`} onPress={() => setSelected(entry)} /></View>)}
      {list.hasNextPage && <TextAction label="More closed gates" disabled={list.isFetchingNextPage} onPress={() => { void list.fetchNextPage(); }} />}
    </>}</>}
    {selected && <BlockPalaceDialog ownerId={ownerId} api={api} person={selected} unblock onClose={() => setSelected(null)} onSaved={() => setSelected(null)} />}
  </View>;
}
const styles = StyleSheet.create({ emblem: { alignItems: 'center', padding: 4 }, panel: { marginTop: 30, padding: 22, gap: 14, backgroundColor: '#EEE7D6', borderWidth: 1, borderColor: '#C3AF89', borderRadius: 4 }, panelTop: { flexDirection: 'row', gap: 14, alignItems: 'center' }, title: { fontFamily: serif, fontSize: 22, color: '#5C503C', flexShrink: 1 }, body: { color: '#665943', fontSize: 13, lineHeight: 22 }, small: { color: '#7B6B52', fontSize: 12, lineHeight: 20 }, error: { color: '#8C4837', fontSize: 13, lineHeight: 22 }, row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTopWidth: 1, borderColor: '#D3C3A2', paddingVertical: 12 }, name: { fontFamily: serif, fontSize: 21, color: '#594B39', flexShrink: 1 }, reason: { padding: 12, minHeight: 44, borderColor: '#CFBF9B', borderWidth: 1, backgroundColor: '#F7EFD9', borderRadius: 3 }, chosen: { borderColor: '#8F7750', backgroundColor: '#E9DCBD' }, details: { minHeight: 82, padding: 12, borderWidth: 1, borderColor: '#B8A27B', backgroundColor: '#FCF5E4', color: '#584A36', textAlignVertical: 'top', fontSize: 14 }, checkbox: { paddingVertical: 12, minHeight: 44 } });
