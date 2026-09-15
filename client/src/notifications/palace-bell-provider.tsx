import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { PalaceEventPage } from '@lantern-post/shared-types';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import { draftStorage } from '../letters/draft-storage';
import { useAppActive } from '../storybook/use-ambient-motion';
import { StoryDialog, TextAction, s } from '../storybook/story-ui';
import { StoryIcon, Flourish } from '../storybook/ornaments';
import { serif } from '../storybook/theme';
import { dismissPalaceArrival, usePalaceConnection, watchPalaceEvents } from '../realtime/palace-live-state';
import { arrivalCopy, eventDestination, readPalaceEvents } from '../realtime/palace-live-contract';
import type { PalaceDestination } from '../realtime/palace-live-contract';
import { BellContext } from './bell-context';
import { BellSeenStore, isBellArrival } from './bell-state';
import { SwipeNotice } from './swipe-notice';

type Props = PropsWithChildren<{ ownerId: string; getToken: GetSessionToken; onOpen: (target: PalaceDestination) => void; chatPeerId?: string }>;
export function PalaceBellProvider(props: Props) {
  return props.ownerId ? <AccountBell key={props.ownerId} {...props} /> : props.children;
}
function AccountBell({ ownerId, getToken, onOpen, chatPeerId, children }: Props) {
  const [open, setOpen] = useState(false); const active = useAppActive(); const connected = usePalaceConnection(ownerId);
  const cache = useQueryClient(); const key = useMemo(() => ['palace-notices', ownerId], [ownerId]);
  const store = useMemo(() => new BellSeenStore(ownerId, draftStorage), [ownerId]);
  const saved = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const currentPeer = useRef(chatPeerId); useEffect(() => { currentPeer.current = chatPeerId; }, [chatPeerId]);
  useEffect(() => store.watch(), [store]);
  const query = useQuery({ queryKey: key, queryFn: async ({ signal }) => readPalaceEvents(await apiRequest('/notifications/inbox', getToken, { signal })), enabled: active, staleTime: 10_000, refetchInterval: active && !connected ? 30_000 : false });
  const events = useMemo(() => (query.data?.events ?? []).filter(event => isBellArrival(event) && !saved.dismissed.includes(event.id)).slice().reverse(), [query.data, saved.dismissed]);
  const seen = useMemo(() => new Set(saved.seen), [saved.seen]); const unseen = events.filter(event => event.alert && !seen.has(event.id)).length;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = watchPalaceEvents(ownerId, event => {
      if (event.kind === 'CHAT_RECEIVED' && event.peerId === currentPeer.current) store.markSeen([event.id]);
      if (event.kind === 'GATES_CHANGED' || event.kind === 'LETTER_REMOVED') cache.setQueryData<PalaceEventPage>(key, old => old ? { ...old, events: old.events.filter(row => event.kind === 'GATES_CHANGED' ? row.peerId !== event.peerId : row.itemId !== event.itemId) } : old);
      if (!timer) timer = setTimeout(() => { timer = undefined; void cache.invalidateQueries({ queryKey: key }); }, 60);
    });
    return () => { stop(); clearTimeout(timer); void cache.cancelQueries({ queryKey: key }); };
  }, [ownerId, cache, key, store]);
  useEffect(() => {
    if (!active) { void cache.cancelQueries({ queryKey: key }); return; }
    if (open) store.markSeen(events.map(event => event.id));
    if (chatPeerId) store.markSeen(events.filter(event => event.kind === 'CHAT_RECEIVED' && event.peerId === chatPeerId).map(event => event.id));
  }, [active, open, chatPeerId, events, store, cache, key]);
  const markItemSeen = useCallback((id: string) => store.markSeen(events.filter(event => event.itemId === id).map(event => event.id)), [events, store]);
  const openBell = useCallback(() => { store.markSeen(events.map(event => event.id)); dismissPalaceArrival(ownerId); setOpen(true); void cache.invalidateQueries({ queryKey: key }); }, [cache, key, ownerId, store, events]);
  const value = useMemo(() => ({ unseen, openBell, markItemSeen }), [unseen, openBell, markItemSeen]);
  return <BellContext.Provider value={value}>{children}{open && active && <StoryDialog title="The palace bells" onClose={() => setOpen(false)}>
    <View style={styles.intro}><StoryIcon kind="bell" size={34} /><Text style={styles.caption}>Little arrivals, kept for you.</Text><Flourish width={110} /></View>
    <Text style={s.body}>Recent arrivals from the past seven days. Swipe a notice left or right to dismiss it. Your letters and conversations stay where they are.</Text>
    {query.isPending && <ActivityIndicator accessibilityLabel="Loading notifications" color="#9A7944" />}
    {query.isError && <View style={styles.empty}><Text role="alert" style={s.body}>The bells could not be checked. Your last arrivals stay here until the post reconnects.</Text><TextAction label="Try notifications again" onPress={() => { void query.refetch(); }} /></View>}
    {!query.isPending && !query.isError && events.length === 0 && <View testID="palace-notifications-empty" style={styles.empty}><Text style={styles.title}>The bells are quiet.</Text><Text style={s.body}>New letters and messages will find a home here.</Text></View>}
    {events.map(event => { const copy = arrivalCopy(event); const isNew = event.alert && !seen.has(event.id); return <SwipeNotice key={event.id} label={copy.title} onDismiss={() => store.dismiss(event.id)}><Pressable testID={`bell-notice-${event.id}`} accessibilityRole="button" accessibilityLabel={`${copy.title}${isNew ? ', new' : ''}. ${copy.action}`} onPress={() => { store.markSeen([event.id]); setOpen(false); onOpen(eventDestination(event)); }} style={({ pressed }) => [styles.notice, isNew && styles.newNotice, pressed && { backgroundColor: '#E8D8B5' }]}>
      <View style={styles.noticeHeading}><StoryIcon kind={event.kind === 'LETTER_RECEIVED' ? 'letter' : event.kind === 'CHAT_RECEIVED' ? 'moon' : 'gate'} size={22} /><Text style={styles.title}>{copy.title}</Text>{isNew && <Text style={styles.newLabel}>NEW</Text>}</View>
      <Text style={s.body}>{copy.body}</Text><Text style={styles.date}>{new Date(event.createdAt).toLocaleString()}</Text><Text style={styles.action}>{copy.action} →</Text>
    </Pressable></SwipeNotice>; })}
    {saved.error && <Text role="alert" style={s.body}>Your notification choices could not be saved on this device. The notices have been kept; please try again.</Text>}
    {events.length > 0 && <TextAction label="Mark all notifications as seen" disabled={!unseen && !saved.error} onPress={() => store.markSeen(events.map(event => event.id))} />}
    <TextAction label="Close the bells" onPress={() => setOpen(false)} />
  </StoryDialog>}</BellContext.Provider>;
}
const styles = StyleSheet.create({
  intro: { alignItems: 'center', gap: 7 }, caption: { fontFamily: serif, fontSize: 17, fontStyle: 'italic', color: '#816B48' },
  empty: { padding: 16, gap: 8, borderWidth: 1, borderColor: '#D6C3A0', backgroundColor: '#F4ECDB', borderRadius: 5 },
  notice: { padding: 14, gap: 8, borderWidth: 1, borderColor: '#D4C3A1', borderRadius: 6, backgroundColor: '#F6EFE0' }, newNotice: { borderColor: '#B3965D', backgroundColor: '#F0E2BF' },
  noticeHeading: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingRight: 30 }, title: { fontFamily: serif, fontSize: 19, color: '#5C472E', flexShrink: 1 },
  newLabel: { fontSize: 8, letterSpacing: 1, color: '#874F44', marginLeft: 'auto' }, date: { fontSize: 10, color: '#897655' }, action: { fontSize: 12, color: '#70552C' },
});
