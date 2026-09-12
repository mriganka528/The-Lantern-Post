import { useState } from 'react';
import type { ReactNode } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import type { FriendConnection, FriendPerson, FriendSearchResult, FriendsView } from '@lantern-post/shared-types';
import { CharacterArt } from '../storybook/character-art';
import { StoryIcon } from '../storybook/ornaments';
import { StoryButton, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { ink, mutedInk, serif } from '../storybook/theme';
import { PalaceCrest } from '../letters/antique-assets';
import { WaxSeal } from '../letters/stationery';
import { FriendGate, FriendGateVisit } from './friend-gate';
import { friendErrorMessage, normalizeFriendSearch, validFriendSearch } from './friends-api';
import type { FriendsTransport } from './friends-api';
import { useFriendAction, useFriendSearch, useFriendsList, useFriendsSummary } from './use-friends-data';

export function FriendsHall({ ownerId, username, api, onBack, notifications, onWrite }: { ownerId: string; username: string; api: FriendsTransport; onBack: () => void; notifications?: ReactNode; onWrite?: (person: FriendPerson) => void }) {
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<FriendsView>('friends');
  const [name, setName] = useState(''); const [query, setQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [visit, setVisit] = useState<{ person: FriendPerson; newlyAccepted: boolean } | null>(null);
  const [decline, setDecline] = useState<FriendConnection | null>(null);
  const summary = useFriendsSummary(api, ownerId);
  const list = useFriendsList(api, ownerId, tab);
  const search = useFriendSearch(api, ownerId, query);
  const action = useFriendAction(api, ownerId);
  const small = width < 650;
  const resultsVisible = query && normalizeFriendSearch(name) === query;
  const entries = list.data?.pages.flatMap(page => page.items) ?? [];
  const refresh = () => { void summary.refetch(); void list.refetch(); if (query) void search.refetch(); };
  async function act(input: { kind: 'send'; username: string } | { kind: 'accept' | 'decline'; id: string }) {
    if (action.isPending) return;
    Keyboard.dismiss();
    setNotice(null);
    try {
      const result = await action.mutateAsync(input);
      setDecline(null);
      if (input.kind === 'accept' && result.status === 'ACCEPTED') { setTab('friends'); setVisit({ person: result.person, newlyAccepted: true }); }
      else if (input.kind === 'decline') setNotice('The invitation has been quietly declined.');
      else if (result.status === 'ACCEPTED') { setTab('friends'); setNotice('This gate is already part of your circle.'); }
      else if (result.direction === 'incoming') { setTab('incoming'); setNotice('An invitation from this palace is already waiting for your reply.'); }
      else { setTab('outgoing'); setNotice(`Your invitation is on its way to @${result.person.username}.`); }
    } catch { /* The confirmed state remains unchanged; the error has a retry path below. */ }
  }
  const submitSearch = () => { if (!validFriendSearch(name)) return; Keyboard.dismiss(); const normalized = normalizeFriendSearch(name); if (normalized === query) void search.refetch(); else setQuery(normalized); setNotice(null); if (!action.isPending) action.reset(); };
  return <>
    <StoryShell chapter="THE COURT OF KINDRED SOULS" actions={<TextAction label="My palace" onPress={onBack} />}>
      <StoryHeading eyebrow="A LITTLE LIGHT, SHARED" title="The friendship court" subtitle="Somewhere beyond the clouds, a familiar soul has a palace too. Leave an invitation at their gate." />
      <View style={styles.banner}>
        <Image source={require('../../assets/storybook/friendship-court.png')} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />
        <View style={styles.bannerPlaque}><PalaceCrest size={42} color="#896B3F" /><Text style={styles.plaqueTitle}>The royal guestbook</Text><Text style={styles.plaqueText}>YOUR PALACE · @{username}</Text></View>
      </View>
      <View style={[styles.searchPanel, !small && { flexDirection: 'row' }]}>
        <View style={{ flex: 1, gap: 8 }}><Text style={s.eyebrow}>FIND A FAMILIAR SOUL</Text><Text style={styles.panelTitle}>A name opens the way.</Text><Text style={s.body}>Search by username to find their palace. Your own name is @{username}.</Text></View>
        <View style={[styles.searchForm, !small && { maxWidth: 470 }]}>
          <View style={styles.inputRow}><Text style={styles.at}>@</Text><TextInput accessibilityLabel="Friend's username" value={name} onChangeText={value => { setName(value); if (!action.isPending) action.reset(); }} maxLength={25} autoCapitalize="none" autoCorrect={false} placeholder="their_username" placeholderTextColor="#938570" returnKeyType="search" onSubmitEditing={submitSearch} style={styles.input} /></View>
          <StoryButton label="Find their palace" onPress={submitSearch} disabled={!validFriendSearch(name)} />
          <Text style={styles.hint}>3–24 letters, numbers, or underscores.</Text>
        </View>
      </View>
      {resultsVisible && <View style={styles.searchResults}>
        <View style={styles.sectionTop}><Text accessibilityRole="header" style={styles.panelTitle}>Palaces in the guestbook</Text><TextAction label="Close search" onPress={() => { setQuery(''); setName(''); }} /></View>
        {search.isPending ? <Waiting label="Looking through the guestbook…" /> : search.isError ? <Problem message={friendErrorMessage(search.error)} onRetry={() => { void search.refetch(); }} /> : <>
          {!search.data.results.length && <Text style={s.body}>No palace matches that name. Try a few more letters, or check the spelling with your friend.</Text>}
          {search.data.results.map(result => <SearchCard key={result.person.id} result={result} busy={action.isPending} onSend={() => { void act({ kind: 'send', username: result.person.username }); }} onIncoming={() => setTab('incoming')} onFriends={() => setVisit({ person: result.person, newlyAccepted: false })} />)}
          {search.data.hasMore && <Text style={styles.hint}>There are more palaces with this beginning. Type more of the username to find yours.</Text>}
        </>}
      </View>}
      {notice && <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text>}
      {action.isPending && <Text accessibilityLiveRegion="polite" style={styles.hint}>The palace post is carrying your reply…</Text>}
      {action.isError && <Problem message={friendErrorMessage(action.error)} onRetry={() => { action.reset(); refresh(); }} label="Refresh the guestbook" />}
      <View style={styles.sectionTop}><Text accessibilityRole="header" style={styles.panelTitle}>Your circle of little lights</Text><TextAction label={list.isFetching ? 'Refreshing…' : 'Refresh'} onPress={refresh} disabled={list.isFetching} /></View>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {([{ key: 'friends', title: 'Friendship gates' }, { key: 'incoming', title: 'At my gate' }, { key: 'outgoing', title: 'Sent invitations' }] as const).map(({ key, title }) => <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected: tab === key }} aria-selected={tab === key} accessibilityLabel={title} onPress={() => { setTab(key); setDecline(null); if (!action.isPending) action.reset(); }} style={[styles.tab, tab === key && styles.selectedTab]}><Text style={[styles.tabText, tab === key && { color: ink }]}>{title}{summary.data ? `  ${summary.data[key]}` : ''}</Text></Pressable>)}
      </View>
      {list.isPending ? <Waiting label="Opening the palace guestbook…" /> : list.isError ? <Problem message={friendErrorMessage(list.error)} onRetry={() => { void list.refetch(); }} /> : !entries.length ? <View style={styles.empty}>
        <StoryIcon kind={tab === 'friends' ? 'gate' : 'letter'} size={39} /><Text style={styles.emptyTitle}>{tab === 'friends' ? 'Every friendship begins with a little hello.' : tab === 'incoming' ? 'The gate is quiet, for now.' : 'A fresh page in the guestbook.'}</Text>
        <Text style={styles.emptyBody}>{tab === 'friends' ? 'Find a friend above and leave an invitation. When it is accepted, their gate will find a place here.' : tab === 'incoming' ? `Share @${username} with someone you know. Their invitation will be waiting here.` : 'Your sent invitations will rest here while you wait for a reply.'}</Text>
      </View> : <View style={tab === 'friends' ? styles.gates : styles.requests}>
        {entries.map(entry => tab === 'friends' ? <FriendGate key={entry.id} person={entry.person} onPress={() => setVisit({ person: entry.person, newlyAccepted: false })} /> : <View key={entry.id} style={styles.invitation}>
          <PersonHeading person={entry.person} /><Text style={styles.invitationCopy}>{tab === 'incoming' ? 'A sealed invitation to join your circle.' : 'Your invitation is waiting at their gate.'}</Text>
          {tab === 'incoming' ? decline?.id === entry.id ? <View style={styles.reply}><Text style={s.body}>Let this invitation pass?</Text><TextAction label={`Keep invitation from ${entry.person.username}`} onPress={() => setDecline(null)} disabled={action.isPending} /><StoryButton label={`Decline ${entry.person.username}'s invitation`} secondary onPress={() => { void act({ kind: 'decline', id: entry.id }); }} disabled={action.isPending} /></View> : <View style={styles.reply}><StoryButton label={`Welcome ${entry.person.username}`} onPress={() => { void act({ kind: 'accept', id: entry.id }); }} disabled={action.isPending} /><TextAction label={`Decline invitation from ${entry.person.username}`} onPress={() => setDecline(entry)} disabled={action.isPending} /></View> : <Text style={styles.waitingReply}>AWAITING A REPLY</Text>}
        </View>)}
      </View>}
      {list.hasNextPage && <View style={{ alignItems: 'center', marginTop: 18 }}><TextAction label={list.isFetchingNextPage ? 'Turning the page…' : 'Turn another page'} onPress={() => { void list.fetchNextPage(); }} disabled={list.isFetchingNextPage} /></View>}
      {summary.isError && <Text style={styles.hint}>Counts are unavailable. Refresh to check for new invitations.</Text>}
      {notifications}
    </StoryShell>
    {visit && <FriendGateVisit person={visit.person} newlyAccepted={visit.newlyAccepted} onClose={() => setVisit(null)} onWrite={onWrite ? () => { const person = visit.person; setVisit(null); onWrite(person); } : undefined} />}
  </>;
}
function SearchCard({ result, busy, onSend, onIncoming, onFriends }: { result: FriendSearchResult; busy: boolean; onSend: () => void; onIncoming: () => void; onFriends: () => void }) {
  return <View style={styles.searchCard}><PersonHeading person={result.person} /><View style={{ alignSelf: 'flex-start' }}>
    {result.relationship === 'NONE' ? <StoryButton label={`Invite ${result.person.username}`} onPress={onSend} disabled={busy} /> : result.relationship === 'INCOMING' ? <TextAction label={`See invitation from ${result.person.username}`} onPress={onIncoming} /> : result.relationship === 'FRIENDS' ? <TextAction label={`Open ${result.person.username}'s gate`} onPress={onFriends} /> : <Text style={styles.waitingReply}>{result.relationship === 'OUTGOING' ? 'INVITATION SENT' : 'NOT RECEIVING INVITATIONS JUST YET'}</Text>}
  </View></View>;
}
function PersonHeading({ person }: { person: FriendPerson }) { return <View style={styles.person}>
  {person.character ? <CharacterArt characterKey={person.character.key} size={62} /> : <WaxSeal color="#98785A" size={45} />}
  <View style={{ flex: 1, gap: 6 }}><Text style={styles.username}>@{person.username}</Text><Text style={styles.palaceName}>{person.character?.palace.name ?? 'A little palace in the clouds'}</Text></View><PalaceCrest size={30} color="#B59C6F" />
</View>; }
function Waiting({ label }: { label: string }) { return <View style={styles.empty}><ActivityIndicator color="#947845" /><Text accessibilityLiveRegion="polite" style={styles.emptyBody}>{label}</Text></View>; }
function Problem({ message, onRetry, label = 'Try again' }: { message: string; onRetry: () => void; label?: string }) { return <View style={styles.problem}><Text role="alert" style={styles.error}>{message}</Text><TextAction label={label} onPress={onRetry} /></View>; }
const styles = StyleSheet.create({
  banner: { height: 235, borderWidth: 1, borderColor: '#C7AF80', overflow: 'hidden', borderTopLeftRadius: 95, borderTopRightRadius: 95, justifyContent: 'center', alignItems: 'center' },
  bannerPlaque: { alignItems: 'center', gap: 9, backgroundColor: 'rgba(248,241,222,.94)', borderColor: '#BEA16B', borderWidth: 1, paddingVertical: 16, paddingHorizontal: 27, borderRadius: 3 },
  plaqueTitle: { fontFamily: serif, fontSize: 27, color: '#5C4933' }, plaqueText: { color: mutedInk, fontSize: 8, letterSpacing: 1.1 },
  searchPanel: { marginTop: 24, borderWidth: 1, borderColor: '#C6AE83', backgroundColor: '#F0E5CF', borderRadius: 4, padding: 22, gap: 25, alignItems: 'center' },
  panelTitle: { fontFamily: serif, fontSize: 27, color: ink, flexShrink: 1 }, searchForm: { width: '100%', flex: 1, gap: 10 },
  inputRow: { flexDirection: 'row', alignItems: 'center', minHeight: 53, paddingHorizontal: 13, backgroundColor: '#FCF7EA', borderWidth: 1, borderColor: '#AD9469', borderRadius: 3 },
  at: { fontFamily: serif, fontSize: 21, color: '#A08A65', paddingRight: 9 }, input: { flex: 1, minWidth: 0, paddingVertical: 13, color: '#4D4030', fontSize: 15 },
  hint: { color: mutedInk, fontSize: 11, lineHeight: 19 }, searchResults: { marginTop: 22, gap: 12 }, sectionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginTop: 30, marginBottom: 15 },
  searchCard: { padding: 18, backgroundColor: '#FCF7EB', borderColor: '#D8C7A6', borderWidth: 1, gap: 13, borderRadius: 4 },
  tabs: { flexDirection: 'row', gap: 5, borderBottomWidth: 1, borderColor: '#C5B08A', flexWrap: 'wrap', paddingBottom: 8 }, tab: { minHeight: 44, paddingVertical: 12, paddingHorizontal: 13, borderRadius: 3 },
  selectedTab: { backgroundColor: '#E8DCC1', borderColor: '#C3A773', borderWidth: 1 }, tabText: { color: mutedInk, fontFamily: serif, fontSize: 16 },
  empty: { paddingVertical: 36, paddingHorizontal: 22, alignItems: 'center', gap: 15, backgroundColor: '#F6EFDF', marginTop: 18, borderColor: '#D9C9AA', borderWidth: 1, borderRadius: 4 }, emptyTitle: { fontFamily: serif, color: ink, fontSize: 23, textAlign: 'center' }, emptyBody: { color: mutedInk, fontSize: 13, lineHeight: 23, maxWidth: 490, textAlign: 'center' },
  gates: { flexDirection: 'row', flexWrap: 'wrap', gap: 15, marginTop: 22 }, requests: { marginTop: 20, gap: 16 }, invitation: { padding: 21, borderColor: '#C6AD7F', borderWidth: 1, backgroundColor: '#F2E7CF', borderRadius: 4, gap: 16 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 13 }, username: { fontFamily: serif, fontSize: 23, color: ink, flexShrink: 1 }, palaceName: { color: mutedInk, fontSize: 11, lineHeight: 18 }, invitationCopy: { color: '#7C684B', fontFamily: serif, fontStyle: 'italic', fontSize: 17 },
  reply: { gap: 8, alignItems: 'flex-start' }, waitingReply: { color: '#7B6B50', fontSize: 9, letterSpacing: 1.1, lineHeight: 18 }, notice: { marginTop: 18, color: '#506343', backgroundColor: '#E8EDDC', padding: 15, lineHeight: 23, fontSize: 13 }, problem: { borderWidth: 1, borderColor: '#CCAB92', backgroundColor: '#F7E9DD', padding: 17, gap: 7, marginTop: 14 }, error: { color: '#864E39', fontSize: 13, lineHeight: 22 },
});
