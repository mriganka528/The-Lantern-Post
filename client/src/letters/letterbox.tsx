import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { FriendPerson, LetterBox, LetterEnvelope } from '@lantern-post/shared-types';
import { StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { StoryIcon } from '../storybook/ornaments';
import { ink, mutedInk, serif } from '../storybook/theme';
import { EnvelopeArt } from './envelope-art';
import { LetterReader } from './letter-reader';
import type { LetterBoxTransport } from './friend-letter-api';
import { letterboxKey, useLetterbox, useLetterboxSummary } from './use-letterbox';

export function PalaceLetterbox({ ownerId, api, onBack, onWrite, onReply }: { ownerId: string; api: LetterBoxTransport; onBack: () => void; onWrite: () => void; onReply?: (person: FriendPerson) => void }) {
  const [box, setBox] = useState<LetterBox>('received'); const [selected, setSelected] = useState<LetterEnvelope | null>(null);
  const list = useLetterbox(api, ownerId, box); const summary = useLetterboxSummary(api, ownerId); const cache = useQueryClient();
  const changed = () => { void cache.invalidateQueries({ queryKey: letterboxKey(ownerId) }); };
  const letters = list.data?.pages.flatMap(page => page.letters) ?? [];
  if (selected) return <LetterReader key={selected.id} item={selected} api={api} onChanged={changed} onBack={() => setSelected(null)} onReply={onReply} />;
  return <StoryShell chapter="THE PALACE LETTERBOX" actions={<TextAction label="My palace" onPress={onBack} />}>
    <StoryHeading eyebrow="BENEATH THE OLD PALACE DOORS" title="Letters at your gate." subtitle="A quiet place for words carried between friends. Open an envelope when you are ready." />
    <View style={styles.crest}><StoryIcon kind="gate" size={49} /><View style={{ flex: 1 }}><Text style={styles.crestTitle}>The private correspondence</Text><Text style={styles.small}>{summary.data?.unread ? `${summary.data.unread} unopened letter${summary.data.unread === 1 ? '' : 's'} waiting` : 'Kept between your two palaces'}</Text></View></View>
    <View style={styles.toolbar}><View accessibilityRole="tablist" style={styles.tabs}>
      {([{ value: 'received', label: 'At my gate' }, { value: 'sent', label: 'Letters I sent' }] as const).map(({ value, label }) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: box === value }} aria-selected={box === value} onPress={() => setBox(value)} style={[styles.tab, box === value && styles.selected]}><Text style={styles.tabText}>{label}{summary.data ? `  ${summary.data[value]}` : ''}</Text></Pressable>)}
    </View><TextAction label={list.isFetching ? 'Refreshing…' : 'Refresh letterbox'} onPress={changed} disabled={list.isFetching} /></View>
    {list.isPending ? <View style={styles.empty}><ActivityIndicator color="#9F814B" /><Text style={s.body}>Looking beneath the palace doors…</Text></View> : list.isError ? <View style={styles.empty}><Text role="alert" style={s.body}>The letterbox could not be opened. Your letters have not been changed.</Text><TextAction label="Try again" onPress={changed} /></View> : !letters.length ? <View style={styles.empty}><StoryIcon kind="letter" size={45} /><Text style={styles.emptyTitle}>{box === 'received' ? 'The post is quiet, for now.' : 'A fresh chapter of correspondence.'}</Text><Text style={styles.emptyBody}>{box === 'received' ? 'When a friend sends you a letter, its sealed envelope will be waiting here.' : 'Letters delivered to your friends will find a place here.'}</Text><TextAction label="Visit my writing desk" onPress={onWrite} /></View> : <View style={styles.grid}>
      {letters.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open letter ${box === 'received' ? 'from' : 'to'} ${item.person.username}${box === 'received' && !item.readAt ? ', unopened' : ''}`} onPress={() => setSelected(item)} style={({ pressed }) => [styles.card, pressed && { opacity: .8 }]}>
        <View style={styles.cardTop}><Text style={styles.stamp}>{box === 'received' && !item.readAt ? 'UNOPENED' : 'PALACE POST'}</Text><Text style={styles.date}>{new Date(item.deliveredAt).toLocaleDateString()}</Text></View>
        <View style={{ alignItems: 'center', marginVertical: 19 }}><EnvelopeArt preset={item.preset} width={205} /></View>
        <Text style={styles.person}>{box === 'received' ? 'From' : 'To'} @{item.person.username}</Text><Text style={styles.small}>{item.person.character?.palace.name ?? 'A friend’s palace'}</Text>
      </Pressable>)}
    </View>}
    {list.hasNextPage && <View style={styles.more}><TextAction label={list.isFetchingNextPage ? 'Turning the page…' : 'More letters'} onPress={() => { void list.fetchNextPage(); }} disabled={list.isFetchingNextPage} /></View>}
    <View style={styles.more}><TextAction label="Write a little letter  →" onPress={onWrite} /></View>
  </StoryShell>;
}
const styles = StyleSheet.create({
  crest: { padding: 22, backgroundColor: '#EEE2C8', borderWidth: 1, borderColor: '#BCA173', borderTopLeftRadius: 40, borderTopRightRadius: 40, gap: 17, flexDirection: 'row', alignItems: 'center' }, crestTitle: { fontFamily: serif, fontSize: 23, color: ink, flexShrink: 1 }, small: { color: mutedInk, fontSize: 11, lineHeight: 20 },
  toolbar: { marginTop: 23, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderBottomWidth: 1, borderColor: '#C9B68E', paddingBottom: 9 }, tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' }, tab: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 3 }, selected: { backgroundColor: '#E9DEC5', borderWidth: 1, borderColor: '#BEA678' }, tabText: { color: ink, fontFamily: serif, fontSize: 17 },
  empty: { alignItems: 'center', gap: 17, padding: 28, marginTop: 20, backgroundColor: '#F5EFDF', borderWidth: 1, borderColor: '#D7C6A2' }, emptyTitle: { fontFamily: serif, fontSize: 25, color: ink, textAlign: 'center' }, emptyBody: { color: mutedInk, fontSize: 13, lineHeight: 23, textAlign: 'center', maxWidth: 500 },
  grid: { marginTop: 22, flexDirection: 'row', flexWrap: 'wrap', gap: 18 }, card: { minWidth: 258, flexBasis: 285, flexGrow: 1, maxWidth: 390, padding: 19, backgroundColor: '#F5EAD3', borderWidth: 1, borderColor: '#C4AC7F', borderRadius: 5 }, cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, stamp: { fontSize: 8, letterSpacing: 1.8, color: '#7E693E' }, date: { fontSize: 10, color: mutedInk }, person: { fontFamily: serif, color: ink, fontSize: 22 }, more: { alignItems: 'center', marginTop: 22 },
});
