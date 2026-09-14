import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { LetterPreset } from '@lantern-post/shared-types';
import { StoryIcon } from '../storybook/ornaments';
import { StoryButton, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { ink, mutedInk, serif } from '../storybook/theme';
import { useMotionPreference } from '../storybook/use-reduced-motion';
import { WaxSeal } from './stationery';
import { AntiquePaperLayers } from './antique-assets';
import { SealingCourt } from './sealing-court';
import { DestinationCourt } from './destination-court';

export function SealedEnvelope({ preset, animate, onFinished, onUnseal, onBack, onSend, onFriend, onWorld, notice, saveError = false, onRetrySave, voicePreview }: { preset: LetterPreset; animate: boolean; onFinished: () => void; onUnseal: () => void; onBack: () => void; onSend?: () => void; onFriend?: () => void; onWorld?: () => void; notice?: string; saveError?: boolean; onRetrySave?: () => void; voicePreview?: ReactNode }) {
  const { width } = useWindowDimensions();
  const { reduced, ready } = useMotionPreference();
  const [fold] = useState(() => new Animated.Value(animate ? 0 : 1));
  useEffect(() => {
    if (!ready) return;
    if (!animate || reduced) { fold.setValue(1); if (animate) onFinished(); return; }
    fold.setValue(0);
    const animation = Animated.timing(fold, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start(({ finished }) => { if (finished) onFinished(); });
    return () => animation.stop();
  }, [animate, fold, onFinished, ready, reduced]);
  const w = Math.min(424, width - 80);
  const h = w * .63;
  const c = preset.config;
  function skip() { fold.stopAnimation(); fold.setValue(1); onFinished(); }
  return <StoryShell chapter="SEALED WITH A LITTLE LIGHT" actions={<TextAction label="My palace" onPress={onBack} disabled={animate} />}>
    <StoryHeading eyebrow="THE CELESTIAL SEALING COURT" title={animate ? 'A little magic, held in wax.' : 'Sealed beneath the stars.'} subtitle={animate ? 'Folded with care. Bound with ribbon. Blessed with a little light.' : 'Your letter rests beneath the palace stars. Sealed, still yours, and waiting for its path.'} />
    <SealingCourt fold={fold}>
      <Animated.View testID="sealed-envelope" style={{ width: w, height: h, backgroundColor: c.paperColor, borderColor: c.ribbonColor, borderWidth: 1, borderRadius: 4, boxShadow: '0px 16px 30px rgba(92,70,33,.15)', transform: [{ translateY: fold.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }}>
        <AntiquePaperLayers preset={preset} />
        <View style={{ position: 'absolute', bottom: 0, width: 0, height: 0, borderLeftWidth: w / 2, borderRightWidth: w / 2, borderBottomWidth: h * .56, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: c.ribbonColor, opacity: .22 }} />
        <Animated.View style={{ position: 'absolute', left: w * .12, top: -h * .4, width: w * .76, height: h * .8, backgroundColor: c.paperColor, borderWidth: 1, borderColor: c.ribbonColor, padding: 20, opacity: fold.interpolate({ inputRange: [0, .46, .55, 1], outputRange: [1, 1, 0, 0] }), transform: [{ translateY: fold.interpolate({ inputRange: [0, .5, 1], outputRange: [0, h * .52, h * .52] }) }, { scaleY: fold.interpolate({ inputRange: [0, .5, 1], outputRange: [1, .1, .1] }) }] }}>
          {[80, 100, 92, 65].map((n, i) => <View key={i} style={{ width: `${n}%`, height: 1, marginBottom: 14, backgroundColor: c.inkColor, opacity: .2 }} />)}
        </Animated.View>
        <Animated.View testID="envelope-ribbon" style={{ position: 'absolute', left: w * .44, width: w * .12, height: h, backgroundColor: c.ribbonColor, opacity: .65, borderLeftWidth: 2, borderRightWidth: 2, borderColor: 'rgba(238,220,172,.7)', transform: [{ scaleY: fold.interpolate({ inputRange: [0, .48, .75, 1], outputRange: [0, 0, 1, 1] }) }] }} />
        <Animated.View testID="envelope-flap" style={{ position: 'absolute', top: -1, left: -1, width: 0, height: 0, borderLeftWidth: w / 2, borderRightWidth: w / 2, borderTopWidth: h * .55, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: c.paperColor, transformOrigin: 'top center', transform: [{ perspective: 700 }, { rotateX: fold.interpolate({ inputRange: [0, .4, .78, 1], outputRange: ['175deg', '175deg', '0deg', '0deg'] }) }] }} />
        <View style={{ position: 'absolute', bottom: 18, right: 20, opacity: .55 }}><StoryIcon kind={c.motif === 'stars' ? 'star' : 'letter'} color={c.inkColor} size={24} /></View>
        <Animated.View testID="envelope-wax" style={{ position: 'absolute', left: w / 2 - 34, top: h * .45 - 17, opacity: fold.interpolate({ inputRange: [0, .72, .82, 1], outputRange: [0, 0, 1, 1] }), transform: [{ translateY: fold.interpolate({ inputRange: [0, .72, .87, 1], outputRange: [-42, -42, 0, 0] }) }, { scale: fold.interpolate({ inputRange: [0, .72, .88, .94, 1], outputRange: [1.8, 1.8, .9, 1.04, 1] }) }] }}><WaxSeal color={c.sealColor} size={68} /></Animated.View>
      </Animated.View>
    </SealingCourt>
    <View style={styles.caption}>
      <Text style={styles.ritual}>I. THE FOLD    ·    II. THE RIBBON    ·    III. THE WAX</Text>
      <View style={styles.registry}><WaxSeal color={c.sealColor} size={54} /><View style={{ gap: 7, flexShrink: 1 }}><Text style={styles.registryEyebrow}>SEALED & KEPT WITH CARE</Text><Text style={styles.presetName}>{preset.displayName}</Text><Text style={s.body}>Your words are still yours. Their journey can wait.</Text></View></View>
      {voicePreview && <View style={{ width: '100%', maxWidth: 460 }}>{voicePreview}</View>}
      {notice && <Text role="alert" style={styles.note}>{notice}</Text>}
      {saveError && <><Text role="alert" style={styles.note}>Your latest changes are not saved yet.</Text><StoryButton label="Retry saving" onPress={() => onRetrySave?.()} secondary /></>}
      {animate ? <TextAction label="Skip sealing animation" onPress={skip} /> : <>
        <DestinationCourt onWorld={onWorld} onFriend={onFriend} onBurn={onSend} onBack={onBack} onUnseal={onUnseal} disabled={saveError} />
      </>}
    </View>
  </StoryShell>;
}

const styles = StyleSheet.create({
  ritual: { color: '#897246', fontSize: 9, lineHeight: 18, letterSpacing: 1.2, textAlign: 'center' },
  caption: { alignItems: 'center', gap: 14, paddingTop: 26 },
  presetName: { fontFamily: serif, color: ink, fontSize: 26 },
  registry: { flexDirection: 'row', gap: 18, alignItems: 'center', padding: 22, borderColor: '#B99C65', borderWidth: 1, backgroundColor: '#F1E5CA', borderRadius: 5, width: '100%', maxWidth: 650 }, registryEyebrow: { color: '#8A7144', fontSize: 8, letterSpacing: 1.8 },
  actions: { gap: 13, width: '100%', maxWidth: 320, marginTop: 13 },
  note: { color: mutedInk, fontSize: 11, lineHeight: 20, textAlign: 'center', maxWidth: 350, paddingHorizontal: 8 },
});
