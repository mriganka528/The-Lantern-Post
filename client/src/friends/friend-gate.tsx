import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FriendPerson } from '@lantern-post/shared-types';
import { CharacterArt } from '../storybook/character-art';
import { palaceArtwork } from '../storybook/artwork';
import { StoryButton, StoryDialog, TextAction, s } from '../storybook/story-ui';
import { StoryIcon } from '../storybook/ornaments';
import { ink, mutedInk, serif } from '../storybook/theme';
import { useMotionPreference } from '../storybook/use-reduced-motion';

export function FriendGate({ person, onPress, compact = false, onChat, onUnfriend }: { person: FriendPerson; onPress: () => void; compact?: boolean; onChat?: () => void; onUnfriend?: () => void }) {
  return <View testID={`friend-card-${person.id}`} style={[styles.card, compact && styles.compact]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${person.username}'s friendship gate`} onPress={onPress} style={({ pressed }) => [styles.openGate, pressed && styles.pressed]}>
    <View style={styles.gate}>
      <View style={styles.halo} /><View style={styles.arch}><View style={styles.leaf}><View style={styles.engraving} /></View><View style={styles.leaf}><View style={styles.engraving} /></View></View>
      <View style={styles.key}><StoryIcon kind="key" size={11} /></View>
      {person.character && <View style={styles.companion}><CharacterArt characterKey={person.character.key} size={27} /></View>}
    </View>
    <View style={styles.identity}><Text style={styles.name} numberOfLines={2}>@{person.username}</Text><Text style={styles.palace} numberOfLines={2}>{person.character?.palace.name ?? 'A little palace in the clouds'}</Text></View>
    <StoryIcon kind="arrow" size={17} color="#806334" />
    </Pressable>
    {(onChat || onUnfriend) && <View style={styles.actions}>
      {onChat && <Pressable accessibilityRole="button" accessibilityLabel={`Chat with ${person.username}`} onPress={onChat} style={({ pressed }) => [styles.action, styles.chatAction, pressed && styles.pressed]}><StoryIcon kind="letter" size={16} color="#455B49" /><Text style={styles.chatLabel}>Chat</Text></Pressable>}
      {onUnfriend && <Pressable accessibilityRole="button" accessibilityLabel={`Unfriend ${person.username}`} onPress={onUnfriend} style={({ pressed }) => [styles.action, styles.removeAction, pressed && styles.pressed]}><Text style={styles.removeLabel}>Unfriend</Text></Pressable>}
    </View>}
  </View>;
}

export function FriendGateVisit({ person, newlyAccepted = false, onClose, onWrite, onBlock, onChat }: { person: FriendPerson; newlyAccepted?: boolean; onClose: () => void; onWrite?: () => void; onBlock?: () => void; onChat?: () => void }) {
  const { reduced, ready } = useMotionPreference();
  const [open] = useState(() => new Animated.Value(0));
  const [laidOut, setLaidOut] = useState(false);
  useEffect(() => {
    if (!ready || !laidOut) return;
    const animation = Animated.timing(open, { toValue: 1, duration: reduced ? 0 : 1250, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start(); return () => animation.stop();
  }, [laidOut, open, ready, reduced]);
  return <StoryDialog title={newlyAccepted ? 'A new gate opens.' : `The gate of ${person.username}`} onClose={onClose}>
    <View testID="friend-gate-reveal" style={styles.reveal} onLayout={({ nativeEvent }) => { if (nativeEvent.layout.width > 0) setLaidOut(true); }} accessibilityRole="image" accessibilityLabel={`An open friendship gate to ${person.username}'s palace`}>
      {person.character ? <Image source={palaceArtwork[person.character.key]} style={styles.scene} resizeMode="cover" accessible={false} /> : <View style={[styles.scene, { backgroundColor: '#E4E5DB' }]} />}
      {person.character && <View style={styles.visitor}><CharacterArt characterKey={person.character.key} size={100} /></View>}
      <Animated.View testID="friend-gate-left" style={[styles.door, { left: 0, transformOrigin: 'left center', opacity: open.interpolate({ inputRange: [0, .92, 1], outputRange: [1, 1, 0] }), transform: [{ perspective: 900 }, { rotateY: open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-105deg'] }) }] }]}><Image source={require('../../assets/storybook/door-left.png')} style={styles.scene} resizeMode="stretch" accessible={false} /></Animated.View>
      <Animated.View style={[styles.door, { right: 0, transformOrigin: 'right center', opacity: open.interpolate({ inputRange: [0, .92, 1], outputRange: [1, 1, 0] }), transform: [{ perspective: 900 }, { rotateY: open.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '105deg'] }) }] }]}><Image source={require('../../assets/storybook/door-right.png')} style={styles.scene} resizeMode="stretch" accessible={false} /></Animated.View>
    </View>
    <Text style={styles.visitName}>@{person.username}</Text>
    <Text style={s.body}>{newlyAccepted ? 'Your palaces are now connected. A little friendship, with a place to call home.' : person.character?.palace.description ?? 'Another little light in your circle of friends.'}</Text>
    {onWrite && <StoryButton label={`Write to ${person.username}`} onPress={onWrite} />}
    {onChat && <StoryButton label={`Chat with ${person.username}`} onPress={onChat} secondary={Boolean(onWrite)} />}
    {onBlock && <TextAction label={`Block ${person.username}`} onPress={onBlock} />}
  </StoryDialog>;
}
const styles = StyleSheet.create({
  card: { width: '100%', borderWidth: 1, borderColor: '#D4BF96', backgroundColor: '#FCF7EB', borderRadius: 6, overflow: 'hidden' },
  compact: { backgroundColor: '#F8F0DF' },
  openGate: { minHeight: 76, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  identity: { flex: 1, minWidth: 0, gap: 4 },
  gate: { width: 46, height: 55, flexShrink: 0, alignItems: 'center', justifyContent: 'flex-end', marginRight: 4 },
  halo: { position: 'absolute', width: '100%', height: '90%', top: 0, borderRadius: 70, backgroundColor: '#E8DEC5', borderWidth: 1, borderColor: '#CBB689' },
  arch: { width: '82%', height: '91%', borderTopLeftRadius: 60, borderTopRightRadius: 60, overflow: 'hidden', borderWidth: 2, borderColor: '#BEA577', backgroundColor: '#625646', flexDirection: 'row' },
  leaf: { width: '50%', backgroundColor: '#7C6B54', borderColor: '#AB9268', borderWidth: 1, padding: 2 }, engraving: { flex: 1, borderWidth: 1, borderColor: '#C2A678', borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  key: { position: 'absolute', top: '48%', padding: 2, backgroundColor: '#ECDDAD', borderRadius: 18, borderColor: '#AD915D', borderWidth: 1 },
  companion: { position: 'absolute', right: -5, bottom: -2 }, name: { fontFamily: serif, color: '#3E5347', fontSize: 17, lineHeight: 23 }, palace: { color: mutedInk, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: 7, borderTopWidth: 1, borderColor: '#E4D8BF', backgroundColor: '#F6F0E2' },
  action: { minHeight: 44, minWidth: 80, paddingHorizontal: 13, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderRadius: 4 },
  chatAction: { backgroundColor: '#E6EBDD', borderColor: '#B6C1A9', marginRight: 'auto' }, chatLabel: { color: '#3F5747', fontSize: 13 },
  removeAction: { backgroundColor: '#FCF7EB', borderColor: '#C6AD8B' }, removeLabel: { color: '#80513D', fontSize: 13 },
  pressed: { backgroundColor: '#EDE1C8' },
  reveal: { height: 252, overflow: 'hidden', borderTopLeftRadius: 140, borderTopRightRadius: 140, borderWidth: 2, borderColor: '#B69B68', backgroundColor: '#EBE3D1' },
  scene: { position: 'absolute', width: '100%', height: '100%' }, visitor: { position: 'absolute', bottom: 0, alignSelf: 'center' }, door: { position: 'absolute', width: '50%', height: '100%', backfaceVisibility: 'hidden' },
  visitName: { fontFamily: serif, color: ink, fontSize: 25, textAlign: 'center' },
});
