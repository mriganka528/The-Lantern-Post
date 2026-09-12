import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { FriendPerson } from '@lantern-post/shared-types';
import { CharacterArt } from '../storybook/character-art';
import { palaceArtwork } from '../storybook/artwork';
import { StoryButton, StoryDialog, s } from '../storybook/story-ui';
import { StoryIcon } from '../storybook/ornaments';
import { ink, mutedInk, serif } from '../storybook/theme';
import { useMotionPreference } from '../storybook/use-reduced-motion';

export function FriendGate({ person, onPress, compact = false }: { person: FriendPerson; onPress: () => void; compact?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${person.username}'s friendship gate`} onPress={onPress} style={({ pressed }) => [styles.card, compact && styles.compact, pressed && { opacity: .8 }]}>
    <View style={[styles.gate, compact && { width: 102, height: 121 }]}>
      <View style={styles.halo} /><View style={styles.arch}><View style={styles.leaf}><View style={styles.engraving} /></View><View style={styles.leaf}><View style={styles.engraving} /></View></View>
      <View style={styles.key}><StoryIcon kind="key" size={20} /></View>
      {person.character && <View style={styles.companion}><CharacterArt characterKey={person.character.key} size={compact ? 40 : 51} /></View>}
    </View>
    <Text style={styles.name} numberOfLines={2}>@{person.username}</Text>
    {!compact && <Text style={styles.palace}>{person.character?.palace.name ?? 'A little palace in the clouds'}</Text>}
  </Pressable>;
}

export function FriendGateVisit({ person, newlyAccepted = false, onClose, onWrite }: { person: FriendPerson; newlyAccepted?: boolean; onClose: () => void; onWrite?: () => void }) {
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
  </StoryDialog>;
}
const styles = StyleSheet.create({
  card: { minWidth: 148, flexGrow: 1, flexBasis: 170, maxWidth: 280, borderWidth: 1, borderColor: '#D4BF96', backgroundColor: '#F8F0DF', padding: 17, borderRadius: 5, gap: 10, alignItems: 'center' },
  compact: { minWidth: 126, flexBasis: 134, maxWidth: 200, padding: 12 }, gate: { width: 124, height: 146, alignItems: 'center', justifyContent: 'flex-end' },
  halo: { position: 'absolute', width: '100%', height: '90%', top: 0, borderRadius: 70, backgroundColor: '#E8DEC5', borderWidth: 1, borderColor: '#CBB689' },
  arch: { width: '82%', height: '91%', borderTopLeftRadius: 60, borderTopRightRadius: 60, overflow: 'hidden', borderWidth: 4, borderColor: '#BEA577', backgroundColor: '#625646', flexDirection: 'row' },
  leaf: { width: '50%', backgroundColor: '#7C6B54', borderColor: '#AB9268', borderWidth: 1, padding: 5 }, engraving: { flex: 1, borderWidth: 1, borderColor: '#C2A678', borderTopLeftRadius: 40, borderTopRightRadius: 40 },
  key: { position: 'absolute', top: '54%', padding: 5, backgroundColor: '#ECDDAD', borderRadius: 18, borderColor: '#AD915D', borderWidth: 1 },
  companion: { position: 'absolute', right: -7, bottom: -3 }, name: { fontFamily: serif, color: ink, fontSize: 17, textAlign: 'center' }, palace: { color: mutedInk, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  reveal: { height: 252, overflow: 'hidden', borderTopLeftRadius: 140, borderTopRightRadius: 140, borderWidth: 2, borderColor: '#B69B68', backgroundColor: '#EBE3D1' },
  scene: { position: 'absolute', width: '100%', height: '100%' }, visitor: { position: 'absolute', bottom: 0, alignSelf: 'center' }, door: { position: 'absolute', width: '50%', height: '100%', backfaceVisibility: 'hidden' },
  visitName: { fontFamily: serif, color: ink, fontSize: 25, textAlign: 'center' },
});
