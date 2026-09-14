import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import type { CharacterKey } from '@lantern-post/shared-types';
import { palettes, serif } from '../storybook/theme';
import { useAmbientMotion, useAppActive } from '../storybook/use-ambient-motion';
import { useReducedMotion } from '../storybook/use-reduced-motion';

const portraits = {
  'fox-lantern': require('../../assets/storybook/desk-fox-lantern.png'), 'rabbit-moon': require('../../assets/storybook/desk-rabbit-moon.png'),
  'owl-scholar': require('../../assets/storybook/desk-owl-scholar.png'), 'deer-dawn': require('../../assets/storybook/desk-deer-dawn.png'),
  'cat-astral': require('../../assets/storybook/desk-cat-astral.png'), 'swan-cloud': require('../../assets/storybook/desk-swan-cloud.png'),
  'unicorn-aurelia': require('../../assets/storybook/desk-unicorn-aurelia.png'), 'peacock-seraph': require('../../assets/storybook/desk-peacock-seraph.png'),
  'lion-solstice': require('../../assets/storybook/desk-lion-solstice.png'), 'dragon-jade': require('../../assets/storybook/desk-dragon-jade.png'),
};
const names: Record<CharacterKey, string> = { 'fox-lantern': 'Ember', 'rabbit-moon': 'Lune', 'owl-scholar': 'Orion', 'deer-dawn': 'Flora', 'cat-astral': 'Celeste', 'swan-cloud': 'Sol', 'unicorn-aurelia': 'Aurelia', 'peacock-seraph': 'Seraph', 'lion-solstice': 'Aurel', 'dragon-jade': 'Jade' };
export function DeskCompanion({ characterKey = 'fox-lantern', writing, recording, voice, compact = false }: { characterKey?: CharacterKey; writing: boolean; recording: boolean; voice: boolean; compact?: boolean }) {
  const [motion] = useState(() => new Animated.Value(0)); const { enabled } = useAmbientMotion(); const active = useAppActive(); const reduced = useReducedMotion();
  const moving = enabled && active && !reduced && (writing || recording);
  useEffect(() => {
    motion.setValue(0); if (!moving) return;
    const options = { useNativeDriver: Platform.OS !== 'web', isInteraction: false, easing: Easing.inOut(Easing.sin) };
    const loop = Animated.loop(Animated.sequence([Animated.timing(motion, { ...options, toValue: 1, duration: recording ? 620 : 300 }), Animated.timing(motion, { ...options, toValue: 0, duration: recording ? 620 : 420 })]));
    loop.start(); return () => loop.stop();
  }, [motion, moving, recording]);
  const pose = recording ? 'recording' : writing && !voice ? 'writing' : 'resting'; const p = palettes[characterKey];
  return <View style={[styles.card, compact && { paddingTop: 12, paddingBottom: 10, marginBottom: 15 }]}>
    <Text style={styles.eyebrow}>YOUR CANDLELIT COMPANY</Text>
    <View style={{ width: compact ? 160 : 306, height: compact ? 141 : 270 }}><View testID={`desk-companion-${characterKey}`} accessibilityRole="image" accessibilityLabel={`${names[characterKey]} seated at a carved desk, ${pose === 'resting' ? 'keeping you company' : pose === 'writing' ? 'writing alongside you' : 'recording with you'}`} style={[styles.scene, { transformOrigin: 'left top', transform: [{ scale: compact ? .52 : 1 }] }]}>
      <Image source={portraits[characterKey]} style={StyleSheet.absoluteFill} accessible={false} />
      {voice ? <View testID={`companion-${pose}`} style={styles.microphone}><View style={styles.micHead}>{[0, 1, 2, 3].map(n => <View key={n} style={styles.grille} />)}</View><View style={styles.micStand} /><View style={styles.micBase} />{recording && <Animated.View testID="companion-recording-light" style={[styles.recordLight, { opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [.45, 1] }), transform: [{ scale: motion.interpolate({ inputRange: [0, 1], outputRange: [1, 1.15] }) }] }]} />}</View> : <Animated.View testID={`companion-${pose}`} style={[styles.hand, { backgroundColor: p.fur, borderColor: p.accent, transform: [{ translateX: motion.interpolate({ inputRange: [0, 1], outputRange: [0, 8] }) }, { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '-4deg'] }) }] }]}><Image source={require('../../assets/storybook/desk-quill.png')} style={styles.quill} accessible={false} /></Animated.View>}
    </View></View>
    <Text style={styles.caption}>{recording ? `${names[characterKey]} is keeping time with your voice.` : writing && !voice ? `Your words, and ${names[characterKey]}’s little quill.` : `${names[characterKey]} has saved you a seat.`}</Text>
  </View>;
}
const styles = StyleSheet.create({ card: { borderWidth: 1, borderColor: '#C2A772', borderTopLeftRadius: 80, borderTopRightRadius: 80, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, backgroundColor: '#F1E6D0', paddingTop: 23, paddingBottom: 17, marginBottom: 24, alignItems: 'center', overflow: 'hidden' }, eyebrow: { color: '#8A7147', fontSize: 9, letterSpacing: 1.4 }, scene: { width: 306, height: 270, transform: [{ scale: .9 }], marginVertical: -5 }, caption: { color: '#725638', fontFamily: serif, fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 15, lineHeight: 20 }, hand: { position: 'absolute', left: 157, top: 154, width: 27, height: 14, borderWidth: 1, borderRadius: 9, transformOrigin: 'left center' }, quill: { position: 'absolute', width: 40, height: 75, left: 11, bottom: 2 }, microphone: { position: 'absolute', left: 190, top: 102, alignItems: 'center' }, micHead: { backgroundColor: '#D7BE85', borderWidth: 2, borderColor: '#95763E', borderRadius: 14, width: 28, height: 45, paddingTop: 8, gap: 5 }, grille: { backgroundColor: '#9F8658', width: 18, height: 1, alignSelf: 'center' }, micStand: { height: 24, width: 4, backgroundColor: '#967442' }, micBase: { width: 41, height: 5, borderRadius: 4, backgroundColor: '#997646' }, recordLight: { width: 9, height: 9, borderRadius: 6, backgroundColor: '#B15944', position: 'absolute', left: 37, top: 12 } });
