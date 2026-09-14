import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { StoryIcon } from '../storybook/ornaments';
import { useAmbientMotion, useAppActive } from '../storybook/use-ambient-motion';
import { useReducedMotion } from '../storybook/use-reduced-motion';

export function SealingCourt({ children, fold }: { children: ReactNode; fold: Animated.Value }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return <View testID="sealing-court" style={styles.court} onLayout={({ nativeEvent }) => setSize(old => old.width === nativeEvent.layout.width && old.height === nativeEvent.layout.height ? old : nativeEvent.layout)}>
    <Image source={require('../../assets/storybook/sealing-court.png')} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} />
    {size.width > 0 && <CourtAmbience width={size.width} height={size.height} fold={fold} />}
    <View style={styles.envelope}>{children}</View>
    <View style={[styles.inset, { pointerEvents: "none" }]} />
  </View>;
}
function CourtAmbience({ width, height, fold }: { width: number; height: number; fold: Animated.Value }) {
  const { enabled } = useAmbientMotion(); const active = useAppActive(); const reduced = useReducedMotion();
  const [breeze] = useState(() => new Animated.Value(0)); const moving = enabled && active && !reduced;
  useEffect(() => { if (!moving) return;
    const options = { useNativeDriver: Platform.OS !== 'web', isInteraction: false, easing: Easing.inOut(Easing.sin) };
    const motion = Animated.loop(Animated.sequence([Animated.timing(breeze, { ...options, toValue: 1, duration: 2600 }), Animated.timing(breeze, { ...options, toValue: 0, duration: 2600 })]));
    motion.start(); return () => motion.stop();
  }, [breeze, moving]);
  return <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Animated.View style={[styles.aureole, { width: Math.min(450, width - 22), height: Math.min(450, width - 22), borderRadius: 240, left: (width - Math.min(450, width - 22)) / 2, top: (height - Math.min(450, width - 22)) / 2, opacity: breeze.interpolate({ inputRange: [0, 1], outputRange: [.35, .7] }), transform: [{ scale: breeze.interpolate({ inputRange: [0, 1], outputRange: [.97, 1.03] }) }] }]} />
    {[false, true].map(right => <View key={String(right)} style={{ position: 'absolute', [right ? 'right' : 'left']: width < 600 ? 23 : 72, top: 0 }}>
      <View style={styles.chain} /><Animated.View style={{ transformOrigin: 'top center', transform: [{ rotate: breeze.interpolate({ inputRange: [0, 1], outputRange: right ? ['-3deg', '3deg'] : ['3deg', '-3deg'] }) }] }}>
        <View style={styles.lanternRoof} /><View style={styles.lantern}><Animated.View style={[styles.lanternLight, { opacity: breeze.interpolate({ inputRange: [0, 1], outputRange: [.5, 1] }) }]} /><StoryIcon kind="star" size={20} color="#FFF5D0" /></View><View style={styles.lanternFoot} />
      </Animated.View>
    </View>)}
    {width > 650 && [false, true].map(right => <Animated.Image key={String(right)} source={require('../../assets/storybook/scenery-angel.png')} style={{ position: 'absolute', [right ? 'right' : 'left']: '15%', top: '39%', width: 78, height: 105, opacity: .8, transform: [{ translateY: breeze.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) }, { scaleX: right ? -1 : 1 }] }} accessible={false} />)}
    {Array.from({ length: 12 }, (_, i) => <Animated.View key={i} testID={i === 0 ? 'sealing-fairy-light' : undefined} style={{ position: 'absolute', left: `${8 + i * 23 % 84}%`, top: `${20 + i * 17 % 62}%`, opacity: breeze.interpolate({ inputRange: [0, 1], outputRange: i % 2 ? [.25, .8] : [.8, .3] }), transform: [{ translateY: breeze.interpolate({ inputRange: [0, 1], outputRange: [0, i % 2 ? -12 : 9] }) }] }}><StoryIcon kind="star" size={i % 3 ? 11 : 18} color="#FFF9DA" /></Animated.View>)}
    <Animated.View testID="sealing-wax-radiance" style={[styles.radiance, { left: width / 2 - 120, top: height / 2 - 120, opacity: fold.interpolate({ inputRange: [0, .72, .87, 1], outputRange: [0, 0, .95, .15] }), transform: [{ scale: fold.interpolate({ inputRange: [0, .72, .9, 1], outputRange: [.6, .6, 1.15, 1.5] }) }] }]} />
  </View>;
}
const styles = StyleSheet.create({
  court: { height: 490, width: '100%', maxWidth: 1100, alignSelf: 'center', marginTop: 12, borderRadius: 120, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderWidth: 1, borderColor: '#BDAB86', backgroundColor: '#ECE3D2', overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  envelope: { paddingTop: 32, zIndex: 1 }, inset: { ...StyleSheet.absoluteFill, margin: 7, borderWidth: 1, borderColor: 'rgba(246,234,199,.8)', borderTopLeftRadius: 113, borderTopRightRadius: 113, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  aureole: { position: 'absolute', borderWidth: 1, borderColor: '#D0B374', backgroundColor: 'rgba(255,248,219,.2)', boxShadow: '0px 0px 40px rgba(255,245,197,.6)' },
  chain: { height: 52, width: 1, backgroundColor: '#AA915E', alignSelf: 'center' }, lanternRoof: { width: 34, height: 13, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#BBA06A', alignSelf: 'center' }, lantern: { width: 29, height: 42, backgroundColor: '#CEB47C', borderWidth: 2, borderColor: '#A18A5A', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, lanternLight: { ...StyleSheet.absoluteFill, backgroundColor: '#FFF0B3', margin: 3, boxShadow: '0px 0px 18px #FFF1B4' }, lanternFoot: { height: 5, width: 36, backgroundColor: '#AE915E' },
  radiance: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: 'rgba(255,247,210,.65)', borderColor: '#EDD59B', borderWidth: 1, boxShadow: '0px 0px 45px rgba(255,244,197,.9)' },
});
