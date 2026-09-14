import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { StoryIcon } from '../storybook/ornaments';
import { useReducedMotion } from '../storybook/use-reduced-motion';
import { useAmbientMotion } from '../storybook/use-ambient-motion';
export interface StarSparkle { x: number; y: number; sequence: number; }
// One transient burst for the whole viewport; no per-star idle animation loops.
export function StarSparkles({ at }: { at: StarSparkle | null }) {
  return at ? <SparkleBurst key={at.sequence} at={at} /> : null;
}
function SparkleBurst({ at }: { at: StarSparkle }) {
  const [progress] = useState(() => new Animated.Value(0)); const [laidOut, setLaidOut] = useState(false); const reduced = useReducedMotion(); const { enabled } = useAmbientMotion(); const still = reduced || !enabled;
  useEffect(() => { if (!laidOut) return; progress.setValue(0); const animation = Animated.timing(progress, { toValue: 1, duration: still ? 220 : 560, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web', isInteraction: false }); animation.start(); return () => animation.stop(); }, [laidOut, progress, still]);
  return <Animated.View  onLayout={() => setLaidOut(true)} testID="sky-star-sparkles" style={[[styles.burst, { left: at.x - 40, top: at.y - 40, opacity: progress.interpolate({ inputRange: [0, .2, 1], outputRange: [.35, .95, 0] }) }], { pointerEvents: "none" }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Animated.View style={[styles.halo, { transform: [{ scale: still ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [.55, 1.2] }) }] }]} />
    {!still && Array.from({ length: 7 }, (_, i) => { const angle = i * Math.PI * 2 / 7; return <Animated.View key={i} style={{ position: 'absolute', left: 35, top: 35, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [Math.cos(angle) * 7, Math.cos(angle) * 35] }) }, { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [Math.sin(angle) * 7, Math.sin(angle) * 35] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, .3] }) }] }}><StoryIcon kind="star" size={i % 2 ? 9 : 12} color="#FFF4BB" /></Animated.View>; })}
    <View style={{ position: 'absolute', left: 28, top: 28 }}><StoryIcon kind="star" size={24} color="#FFF4CE" /></View>
  </Animated.View>;
}
const styles = StyleSheet.create({ burst: { position: 'absolute', width: 80, height: 80, zIndex: 3 }, halo: { position: 'absolute', left: 17, top: 17, width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: '#EBCB84', backgroundColor: 'rgba(255,245,199,.2)', boxShadow: '0px 0px 12px rgba(255,242,194,.7)' } });
