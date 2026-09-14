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
import { useAmbientMotion } from './use-ambient-motion';
import { RoyalNavButton } from './royal-navigation';

export function PalaceHome({ character, username, onCompanions, onAccount, onWrite, onFriends, friends = [], friendSummary, friendsUnavailable = false, onInbox, unreadLetters, onWriteToFriend, onChatToFriend, onInfinity }: { character: CharacterDetails; username: string; onCompanions: () => void; onAccount: () => void; onWrite: () => void; onFriends?: () => void; friends?: FriendConnection[]; friendSummary?: FriendSummary; friendsUnavailable?: boolean; onInbox?: () => void; unreadLetters?: number; onWriteToFriend?: (person: FriendPerson) => void; onChatToFriend?: (person: FriendPerson) => void; onInfinity?: () => void }) {
  const { width } = useWindowDimensions();
  const [arrival, setArrival] = useState<'gate' | 'walking' | 'settled'>('gate');
  const finishWalk = useCallback(() => setArrival('settled'), []);
  const finishGate = useCallback((walk: boolean) => setArrival(walk ? 'walking' : 'settled'), []);
  const { enabled, setEnabled } = useAmbientMotion(); const paused = !enabled;
  const [visit, setVisit] = useState<FriendPerson | null>(null);
  const reduced = useReducedMotion();
  const wide = width >= 850;
  const small = width < 600;
  return <>
    <StoryShell chapter="YOUR LITTLE WORLD" actions={<><TextAction label="Companions" onPress={onCompanions} /><TextAction label="Account" onPress={onAccount} /></>}>
      <StoryHeading eyebrow="A LITTLE CORNER OF FOREVER" title={`Welcome home, ${username}.`} subtitle="Leave the noise of the world at the gate. There is room for all of you here." />
      <View style={styles.sceneHeader}><View style={styles.location}><StoryIcon kind="gate" size={19} /><Text style={styles.locationText}>{character.palace.name}</Text></View><View style={styles.homeTag}><View style={styles.homeDot} /><Text style={styles.homeTagText}>YOUR SANCTUARY</Text></View></View>
      <PalaceScene characterKey={character.key} paused={paused || arrival === 'gate'} arrival={arrival === 'gate' ? 'waiting' : arrival} onArrival={finishWalk} />
      <View style={styles.sceneCaption}><Text style={styles.caption} accessibilityLiveRegion="polite">{arrival === 'walking' ? `${character.displayName} is following the river path home…` : character.palace.description}</Text><View style={styles.sceneActions}>
        {arrival === 'walking' ? <TextAction label="Skip the walk" onPress={finishWalk} /> : <TextAction label="Open the doors again" onPress={() => setArrival('gate')} />}
        {!reduced && <Pressable accessibilityRole="switch" accessibilityLabel="Ambient palace animation" accessibilityState={{ checked: enabled }} aria-checked={enabled} onPress={() => setEnabled(!enabled)} style={styles.motion}><View style={[styles.motionDot, { backgroundColor: paused ? line : gold }]} /><Text style={styles.motionLabel}>{paused ? 'Motion off' : 'Motion on'}</Text></Pressable>}
      </View></View>
      <View testID="home-writing-desk" style={[styles.room, styles.featuredDesk]}>
          <View style={styles.roomHeading}><StoryIcon kind="letter" size={24} /><Text style={styles.soon}>A PLACE FOR YOUR WORDS</Text></View>
          <Text style={styles.roomTitle}>The writing desk</Text><Text style={s.body}>Fresh paper. A little courage. A quiet place for whatever is on your heart.</Text>
          <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}><RoyalNavButton label="Open the writing desk  →" icon="letter" onPress={onWrite} /></View>
        </View>
      {onFriends && <View testID="home-friendship-gates" style={styles.friendCourt}>
        <View style={[styles.friendHeading, small && { flexDirection: 'column', alignItems: 'flex-start', gap: 10 }]}><View style={[styles.friendTitle, small && { width: '100%', flex: undefined }]}><Text style={[s.eyebrow, { textAlign: 'left' }]}>BEYOND YOUR LITTLE WORLD</Text><Text style={styles.roomTitle}>The friendship gates</Text></View><RoyalNavButton icon="gate" label={friendSummary?.incoming ? `The friendship court (${friendSummary.incoming})` : 'The friendship court  →'} onPress={onFriends} /></View>
        {friendsUnavailable ? <Text style={s.body}>The guestbook is behind the mist. Open the friendship court to try again.</Text> : friends.length ? <View style={styles.friendGates}>{friends.slice(0, 4).map(friend => <FriendGate key={friend.id} person={friend.person} compact onPress={() => setVisit(friend.person)} />)}</View> : <Text style={s.body}>Invite someone you know. Their gate will find a home beside yours when they accept.</Text>}
        {friends.length > 0 && <TextAction label="Open the full guestbook  →" onPress={onFriends} />}
        {onInbox && <View testID="home-letterbox-entrance" style={styles.letterboxLink}><View style={styles.letterboxHeading}><StoryIcon kind="letter" size={22} color="#927035" /><Text style={[styles.roomTitle, { fontSize: 21, flexShrink: 1 }]}>The palace letterbox</Text></View><Text style={styles.companionTitle}>{unreadLetters ? `${unreadLetters} unopened letter${unreadLetters === 1 ? '' : 's'} beneath the palace doors` : 'A quiet place for letters between friends'}</Text><View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}><RoyalNavButton icon="letter" label={unreadLetters ? `Open my letterbox (${unreadLetters})` : 'Open my letterbox  →'} onPress={onInbox} /></View></View>}
      </View>}
      <View testID="home-worlds" style={[styles.rooms, wide && { flexDirection: 'row' }]}>
      {onInfinity && <View style={[styles.room, wide && { flex: 1 }, { backgroundColor: '#EAE5ED', borderColor: '#C2B1C5', flexDirection: small ? 'column' : 'row', alignItems: small ? 'stretch' : 'center', gap: 14 }]}>
        <StoryIcon kind="star" size={small ? 24 : 44} color="#A48A57" />
        <View style={{ flex: small ? undefined : 1, gap: 8, minWidth: 0 }}>
          <Text style={[s.eyebrow, small && { textAlign: 'left' }]}>BEYOND THE LAST PALACE GATE</Text>
          <Text style={styles.roomTitle}>The Infinity World</Text>
          <Text style={styles.companionTitle}>A sky of letters, wishes and voices. A little light left for anyone to find.</Text>
          <View style={{ alignSelf: 'flex-start', maxWidth: '100%', marginTop: 4 }}>
            <RoyalNavButton label="Enter the Infinity World" icon="star" primary onPress={onInfinity} />
          </View>
        </View>
      </View>}
        <View style={[styles.room, wide && { flex: 1 }]}>
          <View style={styles.roomHeading}><StoryIcon kind="moon" size={24} /><Text style={styles.soon}>THE FIRE IS READY</Text></View>
          <Text style={styles.roomTitle}>The Burning World</Text><Text style={s.body}>The Burning World is open. Seal a letter at your desk and let the fire carry it away.</Text>
        </View>
      </View>
      <View testID="home-companion" style={styles.rooms}>
        <View style={styles.room}>
          <View style={styles.roomHeading}><Text style={s.eyebrow}>BY YOUR SIDE</Text><StoryIcon kind="star" size={18} /></View>
          <View style={styles.companionRow}><CharacterArt characterKey={character.key} size={79} /><View style={{ flex: 1 }}><Text style={styles.roomTitle}>{character.displayName}</Text><Text style={styles.companionTitle}>{character.title}</Text><TextAction label="Meet the companions  →" onPress={onCompanions} /></View></View>
        </View>


      </View>
    </StoryShell>
    {arrival === 'gate' && <PalaceEntrance character={character} onComplete={finishGate} />}
    {visit && <FriendGateVisit person={visit} onClose={() => setVisit(null)} onWrite={onWriteToFriend ? () => { const person = visit; setVisit(null); onWriteToFriend(person); } : undefined} onChat={onChatToFriend ? () => { const person = visit; setVisit(null); onChatToFriend(person); } : undefined} />}
  </>;
}

const styles = StyleSheet.create({
  sceneHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 13, gap: 12, flexWrap: 'wrap' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 9, maxWidth: '100%' },
  locationText: { color: ink, fontFamily: serif, fontSize: 17, flexShrink: 1 },
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
  room: { borderWidth: 1, borderColor: line, borderRadius: 4, padding: 18, gap: 12, backgroundColor: '#FCF9F2', minWidth: 0 },
  featuredDesk: { marginTop: 12, marginBottom: 12, backgroundColor: '#F1E3C4', borderColor: '#B6985F', borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  roomHeading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  roomTitle: { fontFamily: serif, fontSize: 25, color: ink },
  companionRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  companionTitle: { fontFamily: serif, fontStyle: 'italic', color: mutedInk, fontSize: 13, lineHeight: 20, marginTop: 6 },
  soon: { fontSize: 8, color: mutedInk, letterSpacing: 1.4, borderWidth: 1, borderColor: line, paddingVertical: 5, paddingHorizontal: 7, borderRadius: 3 },
  friendCourt: { marginTop: 12, marginBottom: 12, padding: 18, borderWidth: 1, borderColor: '#CDB88F', backgroundColor: '#F4ECD9', borderRadius: 6, gap: 16 },
  friendTitle: { gap: 7, flex: 1, minWidth: 200 },
  friendHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }, friendGates: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  letterboxLink: { borderTopWidth: 1, borderColor: '#CDB88F', paddingTop: 16, gap: 8 },
  letterboxHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
