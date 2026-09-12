import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Modal, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { CharacterDetails } from '@lantern-post/shared-types';
import { palaceArtwork, walkingArtwork } from './artwork';
import { Flourish, LanternMark } from './ornaments';
import { StoryButton, TextAction, s } from './story-ui';
import { gold, line, palettes, paper, serif } from './theme';
import { useReducedMotion } from './use-reduced-motion';

export function PalaceEntrance({ character, onComplete }: { character: CharacterDetails; onComplete: (walk: boolean) => void }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const finished = useRef(false);
  const [opening, setOpening] = useState(false);
  const doorWidth = Math.min(width - 88, height < 750 ? 236 : 296);
  const doorHeight = doorWidth * 1.25;
  const done = useCallback((walk = false) => {
    if (finished.current) return;
    finished.current = true;
    animation.current?.stop();
    onComplete(walk);
  }, [onComplete]);
  useEffect(() => {
    finished.current = false;
    return () => { finished.current = true; animation.current?.stop(); };
  }, []);
  useEffect(() => { if (reduced && opening) done(); }, [done, opening, reduced]);

  function open() {
    if (opening || finished.current) return;
    if (reduced) { done(); return; }
    setOpening(true);
    animation.current = Animated.timing(progress, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.current.start(({ finished: didFinish }) => { if (didFinish) done(true); });
  }

  return <Modal visible transparent animationType="none" onRequestClose={() => done(false)} statusBarTranslucent>
    <Animated.View style={[styles.overlay, { opacity: progress.interpolate({ inputRange: [0, .74, 1], outputRange: [1, 1, 0] }) }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <LanternMark size={30} />
        <Text style={[s.eyebrow, { marginTop: 14 }]}>A LITTLE MAGIC AWAITS</Text>
        <Text accessibilityRole="header" style={styles.title}>A place to call your own.</Text>
        <Text style={[s.subtitle, { marginTop: 10, marginBottom: 24 }]}>{character.displayName} will lead you home to {character.palace.name}.</Text>
        <View style={[styles.doorFrame, { width: doorWidth + 22, height: doorHeight + 18, borderTopLeftRadius: doorWidth / 2 + 12, borderTopRightRadius: doorWidth / 2 + 12 }]}>
          <View style={[styles.beyond, { backgroundColor: palettes[character.key].mist, borderTopLeftRadius: doorWidth / 2, borderTopRightRadius: doorWidth / 2 }]}>
            <Image source={palaceArtwork[character.key]} style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} resizeMode="cover" accessible={false} />
            <View style={{ width: doorWidth * .45, height: doorWidth * .5 }}>
              {[walkingArtwork[character.key].left, walkingArtwork[character.key].right, walkingArtwork[character.key].body].map((source, index) => <Image key={index} source={source} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="contain" accessible={false} />)}
            </View>
          </View>
          <View style={{ flexDirection: 'row', width: doorWidth, height: doorHeight }}>
            <Animated.View style={{ width: doorWidth / 2, height: doorHeight, transformOrigin: 'left center', backfaceVisibility: 'hidden', transform: [{ perspective: 900 }, { rotateY: progress.interpolate({ inputRange: [0, .8, 1], outputRange: ['0deg', '-102deg', '-104deg'] }) }] }}>
              <Image source={require('../../assets/storybook/door-left.png')} style={styles.door} resizeMode="stretch" accessible={false} />
            </Animated.View>
            <Animated.View style={{ width: doorWidth / 2, height: doorHeight, transformOrigin: 'right center', backfaceVisibility: 'hidden', transform: [{ perspective: 900 }, { rotateY: progress.interpolate({ inputRange: [0, .8, 1], outputRange: ['0deg', '102deg', '104deg'] }) }] }}>
              <Image source={require('../../assets/storybook/door-right.png')} style={styles.door} resizeMode="stretch" accessible={false} />
            </Animated.View>
          </View>
        </View>
        <View style={styles.steps} /><Flourish width={150} />
        <View style={styles.actions}><StoryButton label={opening ? 'Welcome home…' : 'Open the doors'} onPress={open} busy={opening} /><TextAction label="Skip to my palace" onPress={() => done(false)} /></View>
      </ScrollView>
    </Animated.View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: paper },
  content: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  title: { fontFamily: serif, fontSize: 29, lineHeight: 38, color: '#403C32', marginTop: 12, textAlign: 'center' },
  doorFrame: { borderWidth: 1, borderColor: gold, padding: 10, paddingBottom: 0, backgroundColor: '#F0E5CE' },
  beyond: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 0, justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 20, overflow: 'hidden' },
  halo: { position: 'absolute', width: 190, height: 260, borderRadius: 130, backgroundColor: '#FFFAE4', top: 20, opacity: .9 },
  door: { width: '100%', height: '100%' },
  steps: { width: 310, maxWidth: '100%', borderTopWidth: 3, borderBottomWidth: 1, borderColor: line, height: 10, marginBottom: 18 },
  actions: { marginTop: 13, alignItems: 'center', gap: 7, width: '100%', maxWidth: 300 },
});
