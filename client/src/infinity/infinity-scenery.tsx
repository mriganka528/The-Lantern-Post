import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { StoryIcon } from '../storybook/ornaments';
import { useAmbientMotion, useAppActive } from '../storybook/use-ambient-motion';
import { useReducedMotion } from '../storybook/use-reduced-motion';
import { useInfinityLighting } from './use-infinity-lighting';
export function InfinityScenery() {
  const { lighting } = useInfinityLighting(); const night = lighting === 'night';
  const { enabled } = useAmbientMotion(); const active = useAppActive(); const reduced = useReducedMotion(); const [light] = useState(() => new Animated.Value(0)); const moving = enabled && active && !reduced;
  useEffect(() => { if (!moving) return; const settings = { useNativeDriver: Platform.OS !== 'web', isInteraction: false, easing: Easing.inOut(Easing.sin) }; const glow = Animated.loop(Animated.sequence([Animated.timing(light, { ...settings, toValue: 1, duration: 3100 }), Animated.timing(light, { ...settings, toValue: 0, duration: 3100 })])); glow.start(); return () => glow.stop(); }, [light, moving]);
  return <View style={[{ position: 'absolute', width: 1600, height: 1000 }, { pointerEvents: "none" }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Image testID={night ? 'infinity-night-sky' : 'infinity-day-sky'} source={night ? require('../../assets/storybook/infinity-world-night.png') : require('../../assets/storybook/infinity-world.png')} style={StyleSheet.absoluteFill} resizeMode="stretch" accessible={false} />
    {[{ x: 576, y: 378 }, { x: 938, y: 351 }].map(({ x, y }, i) => <Animated.Image key={x} testID={`infinity-angel-${i}`} source={require('../../assets/storybook/scenery-angel.png')} accessible={false} style={{ position: 'absolute', left: x, top: y, width: 85, height: 116, opacity: .85, transform: [{ translateY: light.interpolate({ inputRange: [0, 1], outputRange: [0, i ? -10 : 10] }) }, { scaleX: i ? -1 : 1 }] }} />)}
    <Animated.View testID="infinity-constellations" style={[StyleSheet.absoluteFill, { opacity: light.interpolate({ inputRange: [0, 1], outputRange: [.35, .9] }) }]}>{[225, 440, 622, 981, 1257, 1410].map((x, i) => <View key={x} style={{ position: 'absolute', left: x, top: 97 + i * 79 % 238 }}><StoryIcon kind="star" size={13 + i % 3 * 5} color="#FFF4C8" /></View>)}</Animated.View>
  </View>;
}
