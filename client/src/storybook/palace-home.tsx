import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { CharacterDetails, FriendConnection, FriendPerson, FriendSummary } from '@lantern-post/shared-types';
import { CharacterArt } from './character-art';
import { StoryIcon } from './ornaments';
import { PalaceEntrance } from './palace-entrance';
import { PalaceScene } from './palace-scene';
import { StoryHeading, StoryShell, TextAction, s } from './story-ui';
import { gold, ink, line, mutedInk, serif } from './theme';
import { useReducedMotion } from './use-reduced-motion';
import { FriendGate, FriendGateVisit } from '../friends/friend-gate';

export function PalaceHome({ character, username, onCompanions, onAccount, onWrite, onFriends, friends = [], friendSummary, friendsUnavailable = false, onInbox, unreadLetters, onWriteToFriend }: { character: CharacterDetails; username: string; onCompanions: () => void; onAccount: () => void; onWrite: () => void; onFriends?: () => void; friends?: FriendConnection[]; friendSummary?: FriendSummary; friendsUnavailable?: boolean; onInbox?: () => void; unreadLetters?: number; onWriteToFriend?: (person: FriendPerson) => void }) {
  const { width } = useWindowDimensions();
  const [arrival, setArrival] = useState<'gate' | 'walking' | 'settled'>('gate');
  const finishWalk = useCallback(() => setArrival('settled'), []);
  const finishGate = useCallback((walk: boolean) => setArrival(walk ? 'walking' : 'settled'), []);
  const [paused, setPaused] = useState(false);
  const [visit, setVisit] = useState<FriendPerson | null>(null);
  const reduced = useReducedMotion();
  const wide = width >= 850;
  return <>
    <StoryShell chapter="YOUR LITTLE WORLD" actions={<><TextAction label="Companions" onPress={onCompanions} /><TextAction label="Account" onPress={onAccount} /></>}>
      <StoryHeading eyebrow="A LITTLE CORNER OF FOREVER" title={`Welcome home, ${username}.`} subtitle="Leave the noise of the world at the gate. There is room for all of you here." />
      <View style={styles.sceneHeader}><View style={styles.location}><StoryIcon kind="gate" size={19} /><Text style={styles.locationText}>{character.palace.name}</Text></View><View style={styles.homeTag}><View style={styles.homeDot} /><Text style={styles.homeTagText}>YOUR SANCTUARY</Text></View></View>
      <PalaceScene characterKey={character.key} paused={paused || arrival === 'gate'} arrival={arrival === 'gate' ? 'waiting' : arrival} onArrival={finishWalk} />
      <View style={styles.sceneCaption}><Text style={styles.caption} accessibilityLiveRegion="polite">{arrival === 'walking' ? `${character.displayName} is following the river path home…` : character.palace.description}</Text><View style={styles.sceneActions}>
        {arrival === 'walking' ? <TextAction label="Skip the walk" onPress={finishWalk} /> : <TextAction label="Open the doors again" onPress={() => setArrival('gate')} />}
        {!reduced && <Pressable accessibilityRole="switch" accessibilityLabel="Ambient palace animation" accessibilityState={{ checked: !paused }} aria-checked={!paused} onPress={() => setPaused(value => !value)} style={styles.motion}><View style={[styles.motionDot, { backgroundColor: paused ? line : gold }]} /><Text style={styles.motionLabel}>{paused ? 'Motion off' : 'Motion on'}</Text></Pressable>}
      </View></View>
      {onFriends && <View style={styles.friendCourt}>
        <View style={styles.friendHeading}><View style={{ gap: 7, flex: 1 }}><Text style={s.eyebrow}>BEYOND YOUR LITTLE WORLD</Text><Text style={styles.roomTitle}>The friendship gates</Text></View><TextAction label={friendSummary?.incoming ? `Invitations at my gate (${friendSummary.incoming})` : 'The friendship court  →'} onPress={onFriends} /></View>
        {friendsUnavailable ? <Text style={s.body}>The guestbook is behind the mist. Open the friendship court to try again.</Text> : friends.length ? <View style={styles.friendGates}>{friends.slice(0, 4).map(friend => <FriendGate key={friend.id} person={friend.person} compact onPress={() => setVisit(friend.person)} />)}</View> : <Text style={s.body}>Invite someone you know. Their gate will find a home beside yours when they accept.</Text>}
        {friends.length > 0 && <TextAction label="Open the full guestbook  →" onPress={onFriends} />}
        {onInbox && <View style={styles.letterboxLink}><StoryIcon kind="letter" size={26} /><View style={{ flex: 1 }}><Text style={styles.companionTitle}>{unreadLetters ? `${unreadLetters} unopened letter${unreadLetters === 1 ? '' : 's'} beneath the palace doors` : 'A quiet place for letters between friends'}</Text><TextAction label={unreadLetters ? `Letters at my gate (${unreadLetters})` : 'Open my letterbox  →'} onPress={onInbox} /></View></View>}
      </View>}
      <View style={[styles.rooms, wide && { flexDirection: 'row' }]}>
        <View style={[styles.room, wide && { flex: 1.2 }]}>
          <View style={styles.roomHeading}><Text style={s.eyebrow}>BY YOUR SIDE</Text><StoryIcon kind="star" size={18} /></View>
          <View style={styles.companionRow}><CharacterArt characterKey={character.key} size={79} /><View style={{ flex: 1 }}><Text style={styles.roomTitle}>{character.displayName}</Text><Text style={styles.companionTitle}>{character.title}</Text><TextAction label="Meet the companions  →" onPress={onCompanions} /></View></View>
        </View>
        <View style={[styles.room, wide && { flex: 1 }]}>
          <View style={styles.roomHeading}><StoryIcon kind="letter" size={24} /><Text style={styles.soon}>A PLACE FOR YOUR WORDS</Text></View>
          <Text style={styles.roomTitle}>The writing desk</Text><Text style={s.body}>Fresh paper. A little courage. A quiet place for whatever is on your heart.</Text>
          <TextAction label="Open the writing desk  →" onPress={onWrite} />
        </View>
        <View style={[styles.room, wide && { flex: 1 }]}>
          <View style={styles.roomHeading}><StoryIcon kind="moon" size={24} /><Text style={styles.soon}>THE FIRE IS READY</Text></View>
          <Text style={styles.roomTitle}>Beyond the gates</Text><Text style={s.body}>The Burning World is open. Seal a letter at your desk and let the fire carry it away.</Text>
        </View>
      </View>
    </StoryShell>
    {arrival === 'gate' && <PalaceEntrance character={character} onComplete={finishGate} />}
    {visit && <FriendGateVisit person={visit} onClose={() => setVisit(null)} onWrite={onWriteToFriend ? () => { const person = visit; setVisit(null); onWriteToFriend(person); } : undefined} />}
  </>;
}

const styles = StyleSheet.create({
  sceneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, gap: 12, flexWrap: 'wrap' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  locationText: { color: ink, fontFamily: serif, fontSize: 17 },
  homeTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  homeDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#73826B' },
  homeTagText: { color: mutedInk, fontSize: 8, letterSpacing: 1.5 },
  sceneCaption: { paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  caption: { fontFamily: serif, fontStyle: 'italic', color: mutedInk, fontSize: 13, lineHeight: 22, flexShrink: 1, maxWidth: 520 },
  sceneActions: { flexDirection: 'row', alignItems: 'center', gap: 20, flexWrap: 'wrap' },
  motion: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  motionDot: { width: 5, height: 5, borderRadius: 3 },
  motionLabel: { color: mutedInk, fontSize: 10 },
  rooms: { gap: 20, marginTop: 12 },
  room: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 22, gap: 12, backgroundColor: '#FCF9F2', minWidth: 0 },
  roomHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  roomTitle: { fontFamily: serif, fontSize: 25, color: ink },
  companionRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  companionTitle: { fontFamily: serif, fontStyle: 'italic', color: mutedInk, fontSize: 13, lineHeight: 20, marginTop: 6 },
  soon: { fontSize: 8, color: mutedInk, letterSpacing: 1.4, borderWidth: 1, borderColor: line, paddingVertical: 5, paddingHorizontal: 7, borderRadius: 3 },
  friendCourt: { marginTop: 12, marginBottom: 12, padding: 21, borderWidth: 1, borderColor: '#CDB88F', backgroundColor: '#F4ECD9', borderRadius: 4, gap: 16 },
  friendHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }, friendGates: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  letterboxLink: { borderTopWidth: 1, borderColor: '#D5C39F', paddingTop: 13, flexDirection: 'row', alignItems: 'center', gap: 17 },
});
