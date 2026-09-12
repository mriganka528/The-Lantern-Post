import { useEffect, useState } from 'react';
import { Animated, AppState, Easing, Image, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { LetterPreset } from '@lantern-post/shared-types';
import { ZoomableRealm } from './zoomable-realm';
import { ProgressiveBurnLetter } from './progressive-burn-letter';
import { useReducedMotion } from '../storybook/use-reduced-motion';
import { serif } from '../storybook/theme';

function RealmFlame({ clock, x, bottom, width, height, variant = 0, opacity = 1 }: { clock: Animated.Value; x: number; bottom: number; width: number; height: number; variant?: number; opacity?: number }) {
  const values = variant % 2 ? [.88, 1.08, .94, 1.12, .96, 1.03, .88] : [1.03, .91, 1.11, .97, 1.05, .92, 1.03];
  return <View style={{ position: 'absolute', left: x - width / 2, top: bottom - height, width, height, opacity }}>
    <Animated.Image source={require('../../assets/storybook/ember-glow.png')} style={{ position: 'absolute', width: width * 2.4, height: height * 1.55, left: -width * .7, bottom: -height * .3, opacity: clock.interpolate({ inputRange: [0, .4, .7, 1], outputRange: [.25, .42, .3, .25] }) }} accessible={false} />
    <Animated.View style={[StyleSheet.absoluteFill, { transformOrigin: 'bottom center', transform: [{ scaleY: clock.interpolate({ inputRange: [0, .15, .31, .49, .67, .84, 1], outputRange: values }) }, { skewX: clock.interpolate({ inputRange: [0, .5, 1], outputRange: ['-3deg', '3deg', '-3deg'] }) }] }]}>
      <Image source={require('../../assets/storybook/living-fire-a.png')} style={styles.fill} resizeMode="stretch" accessible={false} />
      <Animated.Image source={require('../../assets/storybook/living-fire-b.png')} style={[styles.fill, { opacity: clock.interpolate({ inputRange: [0, .28, .56, .8, 1], outputRange: [.15, .7, .2, .8, .15] }) }]} resizeMode="stretch" accessible={false} />
    </Animated.View>
  </View>;
}

function BurningAsh({ progress }: { progress: Animated.Value }) {
  return <View testID="burn-ash" style={StyleSheet.absoluteFill} pointerEvents="none">
    {Array.from({ length: 42 }, (_, i) => {
      const start = .22 + i % 19 * .032;
      const end = Math.min(.995, start + .2 + i % 3 * .022);
      const x = 660 + i * 43 % 280;
      const y = 822 - (start - .2) * 277;
      return <Animated.View key={i} testID={i === 7 ? 'floating-ash-fragment' : undefined} style={{ position: 'absolute', left: x, top: y, width: 4 + i % 5, height: 3 + i % 4, borderRadius: i % 3 ? 1 : 5,
        backgroundColor: ['#C9B99C', '#7D6D60', '#F0B960', '#554642'][i % 4], borderLeftWidth: i % 3 ? .7 : 0, borderLeftColor: '#F6D29A',
        ...(i % 4 === 2 ? { boxShadow: '0 0 6px 1px rgba(242, 179, 80, .65)' } : {}),
        opacity: progress.interpolate({ inputRange: [0, start, start + .02, end - .015, end, 1], outputRange: [0, 0, .9, .6, 0, 0] }),
        transform: [{ translateY: progress.interpolate({ inputRange: [0, start, end, 1], outputRange: [0, 0, -140 - i % 7 * 18, -140 - i % 7 * 18] }) },
          { translateX: progress.interpolate({ inputRange: [0, start, end, 1], outputRange: [0, 0, (i % 2 ? -1 : 1) * (20 + i % 6 * 17), (i % 2 ? -1 : 1) * (20 + i % 6 * 17)] }) },
          { rotate: progress.interpolate({ inputRange: [0, start, end, 1], outputRange: ['0deg', '0deg', `${90 + i * 11}deg`, `${90 + i * 11}deg`] }) }],
      }} />;
    })}
  </View>;
}

export function BurningRealm({ progress, confirmed, preset }: { progress: Animated.Value; confirmed: boolean; preset: LetterPreset | null }) {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [active, setActive] = useState(AppState.currentState !== 'background');
  const [flame] = useState(() => new Animated.Value(0));
  const [breath] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (reduced || paused || !active) return;
    const options = { useNativeDriver: Platform.OS !== 'web', isInteraction: false };
    const flicker = Animated.loop(Animated.timing(flame, { ...options, toValue: 1, duration: 4700, easing: Easing.linear }));
    const presence = Animated.loop(Animated.sequence([
      Animated.timing(breath, { ...options, toValue: 1, duration: 5100, easing: Easing.inOut(Easing.sin) }),
      Animated.timing(breath, { ...options, toValue: 0, duration: 5100, easing: Easing.inOut(Easing.sin) }),
    ]));
    flicker.start(); presence.start(); return () => { flicker.stop(); presence.stop(); };
  }, [active, breath, flame, paused, reduced]);
  return <View style={styles.realm}>
    <ZoomableRealm height={width < 600 ? 390 : Math.min(740, (width - 96) * .625)}>
      <Image source={require('../../assets/storybook/ember-realm.png')} style={styles.world} resizeMode="stretch" accessible={false} />
      <Animated.Image source={require('../../assets/storybook/ember-glow.png')} style={{ position: 'absolute', left: 456, top: 55, width: 688, height: 688, opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [.18, .32] }) }} accessible={false} />
      <View testID="realm-ambient-flames" style={StyleSheet.absoluteFill}>
        {[[108, 778, 61, 115], [397, 784, 64, 127], [1203, 778, 61, 115], [1492, 784, 64, 127], [563, 771, 85, 153], [1037, 771, 85, 153], [800, 834, 145, 112]].map(([x, bottom, w, h], i) => <RealmFlame key={i} clock={flame} x={x!} bottom={bottom!} width={w!} height={h!} variant={i} />)}
      </View>
      <RealmFlame clock={flame} x={802} bottom={180} width={95} height={152} opacity={.6} />
      <Animated.Image testID="fire-guardian" source={require('../../assets/storybook/fire-guardian.png')} style={{ position: 'absolute', left: 530, top: 55, width: 540, height: 650, transform: [{ translateY: breath.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] }} resizeMode="contain" accessible={false} />
      <RealmFlame clock={flame} x={556} bottom={477} width={56} height={98} opacity={.85} />
      <RealmFlame clock={flame} x={1044} bottom={477} width={56} height={98} opacity={.85} variant={1} />
      <Animated.Image source={require('../../assets/storybook/ember-glow.png')} style={{ position: 'absolute', left: 680, top: 355, width: 240, height: 240, opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [.15, .35] }) }} accessible={false} />
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: 16 }, (_, i) => <Animated.View key={i} style={{ position: 'absolute', left: 430 + i * 83 % 750, top: 234 + i * 47 % 476, width: 2 + i % 3, height: 2 + i % 3, borderRadius: 4, backgroundColor: '#E7C993', opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [.16, .52] }), transform: [{ translateY: breath.interpolate({ inputRange: [0, 1], outputRange: [0, -19 - i % 5 * 3] }) }] }} />)}
      </View>
      <ProgressiveBurnLetter progress={progress} preset={preset} />
      <Animated.View testID="burn-flames" style={[StyleSheet.absoluteFill, { opacity: confirmed ? progress.interpolate({ inputRange: [0, .12, .25, .73, .96, 1], outputRange: [0, .2, .94, .96, .2, 0] }) : 0 }]}>
        <RealmFlame clock={flame} x={752} bottom={838} width={137} height={266} />
        <RealmFlame clock={flame} x={843} bottom={838} width={143} height={294} variant={1} />
        <RealmFlame clock={flame} x={801} bottom={847} width={97} height={213} opacity={.9} />
      </Animated.View>
      {confirmed && <BurningAsh progress={progress} />}
      <Image source={require('../../assets/storybook/realm-altar.png')} style={styles.world} resizeMode="stretch" accessible={false} />
      {confirmed && <Animated.Image testID="settled-ashes" source={require('../../assets/storybook/ritual-ashes.png')} style={{ position: 'absolute', left: 686, top: 783, width: 228, height: 54, opacity: progress.interpolate({ inputRange: [0, .5, .94, 1], outputRange: [0, 0, 1, 1] }) }} accessible={false} />}
    </ZoomableRealm>
    <View style={styles.legend}><View><Text style={styles.guardianName}>Aureon</Text><Text style={styles.guardianTitle}>KEEPER OF THE EVERFLAME</Text></View>
      {!reduced && <Pressable role="switch" aria-checked={!paused} accessibilityState={{ checked: !paused }} accessibilityLabel="Ambient fire animation" onPress={() => setPaused(value => !value)} style={styles.motion}><View style={[styles.dot, paused && { opacity: .3 }]} /><Text style={styles.motionText}>{paused ? 'Still flames' : 'Living flames'}</Text></Pressable>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  realm: { width: '100%', alignSelf: 'center' }, fill: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' }, world: { position: 'absolute', width: 1600, height: 1000 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, gap: 12 },
  guardianName: { color: '#725331', fontFamily: serif, fontSize: 22 }, guardianTitle: { color: '#8D7957', fontSize: 8, letterSpacing: 1.8, marginTop: 4 },
  motion: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7 }, dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#B58645' }, motionText: { color: '#7E6E52', fontSize: 11 },
});
