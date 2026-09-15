import { useCallback, useEffect, useState } from 'react';
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
import { GuidanceTarget, useGuidance } from '../guidance/guidance-context';
import { GuidanceSection } from '../guidance/guidance-section';

export function PalaceHome({ character, username, active = true, onCompanions, onAccount, onWrite, onFriends, friends = [], friendSummary, friendsUnavailable = false, onInbox, unreadLetters, onWriteToFriend, onChatToFriend, onInfinity }: { character: CharacterDetails; username: string; active?: boolean; onCompanions: () => void; onAccount: () => void; onWrite: () => void; onFriends?: () => void; friends?: FriendConnection[]; friendSummary?: FriendSummary; friendsUnavailable?: boolean; onInbox?: () => void; unreadLetters?: number; onWriteToFriend?: (person: FriendPerson) => void; onChatToFriend?: (person: FriendPerson) => void; onInfinity?: () => void }) {
  const { width } = useWindowDimensions();
  const [arrival, setArrival] = useState<'gate' | 'walking' | 'settled'>('gate');
  const finishWalk = useCallback(() => setArrival('settled'), []);
  const finishGate = useCallback((walk: boolean) => setArrival(walk ? 'walking' : 'settled'), []);
  const { enabled, setEnabled } = useAmbientMotion(); const paused = !enabled;
  const [visit, setVisit] = useState<FriendPerson | null>(null);
  const reduced = useReducedMotion();
  const guide = useGuidance(); const guideReady = guide?.setReady;
  useEffect(() => { guideReady?.(active && arrival === 'settled'); return () => guideReady?.(false); }, [active, arrival, guideReady]);
  const wide = width >= 850;
  const small = width < 600;
  return <>
    <StoryShell chapter="YOUR LITTLE WORLD" scrollRef={guide?.scrollRef} onScroll={guide?.onScroll} onMomentumScrollEnd={guide?.onMomentumScrollEnd} scrollEnabled={!guide?.active} actions={<><GuidanceTarget id="companions"><TextAction label="Companions" onPress={onCompanions} /></GuidanceTarget><GuidanceTarget id="account"><TextAction label="Account" onPress={onAccount} /></GuidanceTarget></>}>
      <StoryHeading eyebrow="A LITTLE CORNER OF FOREVER" title={`Welcome home, ${username}.`} subtitle="Leave the noise of the world at the gate. There is room for all of you here." />
      <View style={styles.sceneHeader}><View style={styles.location}><StoryIcon kind="gate" size={19} /><Text style={styles.locationText}>{character.palace.name}</Text></View><View style={styles.homeTag}><View style={styles.homeDot} /><Text style={styles.homeTagText}>YOUR SANCTUARY</Text></View></View>
      <PalaceScene characterKey={character.key} paused={paused || !active || arrival === 'gate'} arrival={!active || arrival === 'gate' ? 'waiting' : arrival} onArrival={finishWalk} />
      <View style={styles.sceneCaption}><Text style={styles.caption} accessibilityLiveRegion="polite">{arrival === 'walking' ? `${character.displayName} is following the river path home…` : character.palace.description}</Text><View style={styles.sceneActions}>
        {arrival === 'walking' ? <TextAction label="Skip the walk" onPress={finishWalk} /> : <TextAction label="Open the doors again" onPress={() => setArrival('gate')} />}
        {!reduced && <Pressable accessibilityRole="switch" accessibilityLabel="Ambient palace animation" accessibilityState={{ checked: enabled }} aria-checked={enabled} onPress={() => setEnabled(!enabled)} style={styles.motion}><View style={[styles.motionDot, { backgroundColor: paused ? line : gold }]} /><Text style={styles.motionLabel}>{paused ? 'Motion off' : 'Motion on'}</Text></Pressable>}
      </View></View>
      <GuidanceTarget id="writing" testID="home-writing-desk" style={[styles.room, styles.featuredDesk]}>
          <View style={styles.roomHeading}><View style={styles.featureTitle}><StoryIcon kind="letter" size={22} /><Text style={styles.roomTitle}>The writing desk</Text></View><Text style={styles.soon}>START HERE</Text></View>
          <Text style={s.body}>Write a letter or record your voice. Choose where it goes after sealing it.</Text>
          <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}><RoyalNavButton label="Open the writing desk  →" icon="letter" onPress={onWrite} /></View>
        </GuidanceTarget>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Friends & letters</Text><Text style={styles.sectionHint}>Conversations at the gates. Letters in the letterbox.</Text></View>
      {onFriends && <View testID="home-friendship-gates" style={styles.friendCourt}>
        <GuidanceTarget id="friends" testID="guidance-friendship-gates" style={{gap:12}}><View style={styles.featureTitle}><StoryIcon kind="gate" size={22}/><Text style={styles.roomTitle}>The friendship gates</Text></View><Text style={s.body}>Find friends by username, manage invitations, and open a friend’s gate to chat.</Text><View style={{alignSelf:'flex-start',maxWidth:'100%'}}><RoyalNavButton icon="gate" label={friendSummary?.incoming ? `The friendship court (${friendSummary.incoming})` : 'The friendship court  →'} onPress={onFriends} /></View></GuidanceTarget>
        {friendsUnavailable ? <Text style={s.body}>The guestbook is behind the mist. Open the friendship court to try again.</Text> : friends.length ? <View style={styles.friendGates}>{friends.slice(0, 4).map(friend => <View key={friend.id} style={{ width: small ? '100%' : '48%' }}><FriendGate person={friend.person} compact onPress={() => setVisit(friend.person)} /></View>)}</View> : <Text style={s.body}>Invite someone you know. Their gate will find a home beside yours when they accept.</Text>}
      </View>}
      {onInbox && <GuidanceTarget id="letterbox" testID="home-letterbox-entrance" style={[styles.room,styles.letterboxCard]}><View style={styles.featureTitle}><StoryIcon kind="letter" size={22} color="#667954" /><Text style={styles.roomTitle}>The palace letterbox</Text></View><Text style={s.body}>Read letters from your friends and revisit the ones you sent.</Text>{Boolean(unreadLetters)&&<Text style={styles.unread}>{unreadLetters} unread letter{unreadLetters===1?'':'s'}</Text>}<View style={{alignSelf:'flex-start',maxWidth:'100%'}}><RoyalNavButton icon="letter" label={unreadLetters ? `Open my letterbox (${unreadLetters})` : 'Open my letterbox  →'} onPress={onInbox} /></View></GuidanceTarget>}
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Choose a world</Text><Text style={styles.sectionHint}>Explore shared words, or let a letter go.</Text></View>
      <View testID="home-worlds" style={[styles.rooms, wide && { flexDirection: 'row' }]}>
      {onInfinity && <GuidanceTarget id="infinity" testID="home-infinity" style={[styles.room, wide && { flex: 1 }, { backgroundColor: '#EAE5ED', borderColor: '#C2B1C5', gap: 12 }]}>
          <View style={styles.featureTitle}><StoryIcon kind="star" size={22} color="#897095" /><Text style={styles.roomTitle}>The Infinity World</Text></View>
          <Text style={s.body}>Explore letters shared by the community. Touch a star to open its story.</Text>
          <View style={{ alignSelf: 'flex-start', maxWidth: '100%', marginTop: 4 }}>
            <RoyalNavButton label="Enter the Infinity World" icon="star" primary onPress={onInfinity} />
          </View>
      </GuidanceTarget>}
        <GuidanceTarget id="fire" testID="home-fire" style={[styles.room, wide && { flex: 1 },styles.fireCard]}>
          <View style={styles.featureTitle}><StoryIcon kind="moon" size={22} color="#A27554" /><Text style={styles.roomTitle}>The Burning World</Text></View>
          <Text style={s.body}>For words you want to release. Write and seal a letter, then choose “Let it go to the fire.”</Text>
          <View style={{alignSelf:'flex-start',maxWidth:'100%'}}><RoyalNavButton label="Prepare a letter for the fire" icon="letter" onPress={onWrite}/></View>
        </GuidanceTarget>
      </View>
      <View testID="home-companion" style={styles.rooms}>
        <View style={styles.room}>
          <View style={styles.companionRow}><CharacterArt characterKey={character.key} size={58} /><View style={{ flex: 1 }}><Text style={styles.sectionHint}>YOUR COMPANION</Text><Text style={styles.roomTitle}>{character.displayName}</Text><TextAction label="Meet the companions  →" onPress={onCompanions} /></View></View>
        </View>


      </View>
      <GuidanceSection />
    </StoryShell>
    {active && arrival === 'gate' && <PalaceEntrance character={character} onComplete={finishGate} />}
    {active && visit && <FriendGateVisit person={visit} onClose={() => setVisit(null)} onWrite={onWriteToFriend ? () => { const person = visit; setVisit(null); onWriteToFriend(person); } : undefined} onChat={onChatToFriend ? () => { const person = visit; setVisit(null); onChatToFriend(person); } : undefined} />}
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
  roomTitle: { fontFamily: serif, fontSize: 25, color: ink, flexShrink:1 },
  featureTitle: { flexDirection:'row',alignItems:'center',gap:10,maxWidth:'100%',flexShrink:1 },
  sectionHeading: { marginTop:24,marginBottom:2,gap:6 },sectionTitle:{fontFamily:serif,fontSize:20,color:'#62583F'},sectionHint:{fontSize:11,lineHeight:18,color:mutedInk},
  letterboxCard:{marginTop:0,backgroundColor:'#EEF0E5',borderColor:'#B8C1A6'},unread:{fontSize:12,color:'#435D45',fontWeight:'600'},fireCard:{backgroundColor:'#F3E8DC',borderColor:'#CCAF96'},
  companionRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  companionTitle: { fontFamily: serif, fontStyle: 'italic', color: mutedInk, fontSize: 13, lineHeight: 20, marginTop: 6 },
  soon: { fontSize: 8, color: mutedInk, letterSpacing: 1.4, borderWidth: 1, borderColor: line, paddingVertical: 5, paddingHorizontal: 7, borderRadius: 3 },
  friendCourt: { marginTop: 12, marginBottom: 12, padding: 18, borderWidth: 1, borderColor: '#CDB88F', backgroundColor: '#F4ECD9', borderRadius: 6, gap: 16 },
  friendTitle: { gap: 7, flex: 1, minWidth: 200 },
  friendHeading: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }, friendGates: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  letterboxLink: { borderTopWidth: 1, borderColor: '#CDB88F', paddingTop: 16, gap: 8 },
  letterboxHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
