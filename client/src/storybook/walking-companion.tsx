import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import type { CharacterKey } from '@lantern-post/shared-types';
import { characterArtwork, walkingArtwork } from './artwork';

export type ArrivalStage = 'waiting' | 'walking' | 'settled';

export function WalkingCompanion({ characterKey, stage, reduced, onArrival }: { characterKey: CharacterKey; stage: ArrivalStage; reduced: boolean; onArrival?: () => void }) {
  const [path] = useState(() => new Animated.Value(stage === 'settled' ? 1 : 0));
  const [step] = useState(() => new Animated.Value(0));
  const native = Platform.OS !== 'web';
  useEffect(() => {
    if (stage === 'waiting') { path.setValue(0); return; }
    if (stage === 'settled' || reduced) { path.setValue(1); if (stage === 'walking') onArrival?.(); return; }
    path.setValue(0);
    const walk = Animated.timing(path, { toValue: 1, duration: 3600, easing: Easing.linear, useNativeDriver: native });
    const gait = Animated.loop(Animated.sequence([
      Animated.timing(step, { toValue: 1, duration: 240, easing: Easing.inOut(Easing.sin), useNativeDriver: native, isInteraction: false }),
      Animated.timing(step, { toValue: 0, duration: 240, easing: Easing.inOut(Easing.sin), useNativeDriver: native, isInteraction: false }),
    ]));
    gait.start();
    walk.start(({ finished }) => { if (finished) { gait.stop(); onArrival?.(); } });
    return () => { walk.stop(); gait.stop(); };
  }, [native, onArrival, path, reduced, stage, step]);
  const art = walkingArtwork[characterKey];
  return <Animated.View testID="palace-companion-path" pointerEvents="none" style={[styles.actor, {
    transform: [
      { translateX: path.interpolate({ inputRange: [0, .3, .7, 1], outputRange: [530, 525, 518, 515] }) },
      { translateY: path.interpolate({ inputRange: [0, .3, .7, 1], outputRange: [510, 456, 396, 365] }) },
      { scale: path.interpolate({ inputRange: [0, 1], outputRange: [1, .62] }) },
    ],
  }]}>
    <View style={styles.shadow} />
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: path.interpolate({ inputRange: [0, .94, 1], outputRange: [1, 1, 0] }) }]}>
      <Animated.Image testID="companion-left-step" source={art.left} style={[styles.part, { transformOrigin: '60px 142px', transform: [{ translateY: step.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) }, { rotate: step.interpolate({ inputRange: [0, 1], outputRange: ['-8deg', '8deg'] }) }] }]} resizeMode="contain" />
      <Animated.Image source={art.right} style={[styles.part, { transformOrigin: '96px 142px', transform: [{ translateY: step.interpolate({ inputRange: [0, 1], outputRange: [-9, 0] }) }, { rotate: step.interpolate({ inputRange: [0, 1], outputRange: ['8deg', '-8deg'] }) }] }]} resizeMode="contain" />
      <Animated.Image source={art.body} style={[styles.part, { transform: [{ translateY: step.interpolate({ inputRange: [0, .5, 1], outputRange: [0, -3, 0] }) }] }]} resizeMode="contain" />
    </Animated.View>
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: path.interpolate({ inputRange: [0, .94, 1], outputRange: [0, 0, 1] }) }]}><Image source={characterArtwork[characterKey]} style={styles.part} resizeMode="contain" /></Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  actor: { position: 'absolute', left: 0, top: 0, width: 160, height: 180, transformOrigin: '80px 160px' },
  part: { position: 'absolute', width: 160, height: 180 },
  shadow: { position: 'absolute', left: 42, top: 157, width: 76, height: 12, borderRadius: 40, backgroundColor: 'rgba(101,83,52,.17)' },
});
