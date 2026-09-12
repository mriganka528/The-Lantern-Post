import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { CharacterKey } from '@lantern-post/shared-types';
import { palaceArtwork } from './artwork';
import { StoryIcon } from './ornaments';
import { line, palettes } from './theme';
import { useReducedMotion } from './use-reduced-motion';
import { WalkingCompanion } from './walking-companion';
import type { ArrivalStage } from './walking-companion';

export function PalaceScene({ characterKey, compact = false, paused = false, arrival = 'settled', onArrival, worldOverlay }: {
  characterKey: CharacterKey; compact?: boolean; paused?: boolean; arrival?: ArrivalStage; onArrival?: () => void; worldOverlay?: ReactNode;
}) {
  const { width } = useWindowDimensions();
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const reduced = useReducedMotion();
  const [drift] = useState(() => new Animated.Value(0));
  const [water] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (reduced || paused || compact) return;
    const settings = { useNativeDriver: Platform.OS !== 'web', isInteraction: false };
    const breeze = Animated.loop(Animated.sequence([
      Animated.timing(drift, { ...settings, toValue: 1, duration: 3600, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(drift, { ...settings, toValue: 0, duration: 3600, easing: Easing.inOut(Easing.sin) }),
    ]));
    const stream = Animated.loop(Animated.timing(water, { ...settings, toValue: 1, duration: 1400, easing: Easing.linear }));
    breeze.start(); stream.start();
    return () => { breeze.stop(); stream.stop(); };
  }, [compact, drift, paused, reduced, water]);
  const height = compact ? 196 : width < 600 ? Math.min(300, (width - 40) * .78) : Math.min(660, (width - 96) * .55);
  const scale = Math.max(layout.width / 1200, layout.height / 660);
  return <View style={[styles.scene, { height, backgroundColor: palettes[characterKey].mist }]}
    onLayout={({ nativeEvent }) => setLayout({ width: nativeEvent.layout.width, height: nativeEvent.layout.height })}
    accessibilityLabel="A majestic palace with a flowing river, waterfalls, royal queens, and angels among the clouds" accessible accessibilityRole="image">
    {layout.width > 0 && <View style={{ position: 'absolute', width: 1200, height: 660, left: (layout.width - 1200 * scale) / 2, top: (layout.height - 660 * scale) / 2, transformOrigin: 'left top', transform: [{ scale }] }}>
      <Image source={palaceArtwork[characterKey]} style={styles.landscape} resizeMode="stretch" accessible={false} />
      <Animated.Image testID="river-current" source={require('../../assets/storybook/river-light.png')} style={[styles.landscape, { opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [.35, .8] }), transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-5, 5] }) }] }]} resizeMode="stretch" accessible={false} />
      {[204, 952].map(x => <View key={x} style={{ position: 'absolute', left: x, top: 374, width: 43, height: 145, overflow: 'hidden' }}>
        <Animated.Image testID={'waterfall-' + x} source={require('../../assets/storybook/waterfall-light.png')} style={{ width: 43, height: 170, top: -22, opacity: .85, transform: [{ translateY: water.interpolate({ inputRange: [0, .8, 1], outputRange: [0, 30, 38] }) }] }} resizeMode="stretch" accessible={false} />
      </View>)}
      {[{ x: 319, y: 40 }, { x: 789, y: 31 }].map(({ x, y }, index) => <Animated.Image key={x} source={require('../../assets/storybook/scenery-angel.png')} style={{ position: 'absolute', left: x, top: y, width: 92, height: 125, opacity: .86, transform: [{ translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [0, index ? 10 : -10] }) }, { rotate: index ? '8deg' : '-8deg' }] }} accessible={false} />)}
      {[397, 749].map((x, index) => <View key={x} style={{ position: 'absolute', left: x, top: 341 }}>
        <Animated.Image source={require('../../assets/storybook/scenery-queen.png')} style={{ width: 56, height: 76, transformOrigin: 'bottom center', transform: [{ scaleX: index ? -1 : 1 }, { rotate: drift.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] }) }] }} accessible={false} />
        <View style={styles.balcony} />
      </View>)}
      {!compact && <>
        <WalkingCompanion characterKey={characterKey} stage={arrival} reduced={reduced} onArrival={onArrival} />
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: drift.interpolate({ inputRange: [0, 1], outputRange: [.3, .85] }) }]}>
          {([[199, 161], [973, 136], [450, 104], [739, 106], [847, 555]] as const).map(([x, y], i) => <View key={i} style={{ position: 'absolute', left: x, top: y }}><StoryIcon kind="star" size={i % 2 ? 14 : 21} color="#FFF6C5" /></View>)}
        </Animated.View>
      </>}
      {worldOverlay}
    </View>}
    <View pointerEvents="none" style={styles.frame} />
  </View>;
}

const styles = StyleSheet.create({
  scene: { overflow: 'hidden', borderWidth: 1, borderColor: line, borderTopLeftRadius: 140, borderTopRightRadius: 140, width: '100%' },
  landscape: { position: 'absolute', width: 1200, height: 660 },
  balcony: { width: 70, marginLeft: -7, height: 10, borderColor: '#B19A72', borderWidth: 1, backgroundColor: '#EEDFC4', marginTop: -4 },
  frame: { ...StyleSheet.absoluteFill, margin: 7, borderWidth: 1, borderColor: 'rgba(163,132,73,.35)', borderTopLeftRadius: 133, borderTopRightRadius: 133 },
});
