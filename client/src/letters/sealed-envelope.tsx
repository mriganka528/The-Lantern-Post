import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { LetterPreset } from '@lantern-post/shared-types';
import { StoryIcon } from '../storybook/ornaments';
import { StoryButton, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { ink, mutedInk, serif } from '../storybook/theme';
import { useMotionPreference } from '../storybook/use-reduced-motion';
import { WaxSeal } from './stationery';
import { AntiquePaperLayers } from './antique-assets';

export function SealedEnvelope({ preset, animate, onFinished, onUnseal, onBack, onSend, onFriend, notice, saveError = false, onRetrySave }: { preset: LetterPreset; animate: boolean; onFinished: () => void; onUnseal: () => void; onBack: () => void; onSend?: () => void; onFriend?: () => void; notice?: string; saveError?: boolean; onRetrySave?: () => void }) {
  const { width } = useWindowDimensions();
  const { reduced, ready } = useMotionPreference();
  const [fold] = useState(() => new Animated.Value(animate ? 0 : 1));
  useEffect(() => {
    if (!ready) return;
    if (!animate || reduced) { fold.setValue(1); if (animate) onFinished(); return; }
    fold.setValue(0);
    const animation = Animated.timing(fold, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start(({ finished }) => { if (finished) onFinished(); });
    return () => animation.stop();
  }, [animate, fold, onFinished, ready, reduced]);
  const w = Math.min(424, width - 80);
  const h = w * .63;
  const c = preset.config;
  function skip() { fold.stopAnimation(); fold.setValue(1); onFinished(); }
  return <StoryShell chapter="SEALED WITH A LITTLE LIGHT" actions={<TextAction label="My palace" onPress={onBack} disabled={animate} />}>
    <StoryHeading eyebrow="CHAPTER II · HELD WITH CARE" title={animate ? 'A little fold. A little courage.' : 'Sealed, and still yours.'} subtitle={animate ? 'Tucking your words into something beautiful.' : 'Your words are safe in their envelope. Nothing has been sent.'} />
    <View style={[styles.stage, { paddingTop: h * .6 + 12 }]}>
      <View style={[styles.halo, { width: w + 90, height: w + 90, borderRadius: w }]} />
      <Animated.View testID="sealed-envelope" style={{ width: w, height: h, backgroundColor: c.paperColor, borderColor: c.ribbonColor, borderWidth: 1, borderRadius: 4, boxShadow: '0px 16px 30px rgba(92,70,33,.15)', transform: [{ translateY: fold.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) }] }}>
        <AntiquePaperLayers preset={preset} />
        <View style={{ position: 'absolute', bottom: 0, width: 0, height: 0, borderLeftWidth: w / 2, borderRightWidth: w / 2, borderBottomWidth: h * .56, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: c.ribbonColor, opacity: .22 }} />
        <Animated.View style={{ position: 'absolute', left: w * .12, top: -h * .4, width: w * .76, height: h * .8, backgroundColor: c.paperColor, borderWidth: 1, borderColor: c.ribbonColor, padding: 20, opacity: fold.interpolate({ inputRange: [0, .46, .55, 1], outputRange: [1, 1, 0, 0] }), transform: [{ translateY: fold.interpolate({ inputRange: [0, .5, 1], outputRange: [0, h * .52, h * .52] }) }, { scaleY: fold.interpolate({ inputRange: [0, .5, 1], outputRange: [1, .1, .1] }) }] }}>
          {[80, 100, 92, 65].map((n, i) => <View key={i} style={{ width: `${n}%`, height: 1, marginBottom: 14, backgroundColor: c.inkColor, opacity: .2 }} />)}
        </Animated.View>
        <View style={{ position: 'absolute', left: w * .44, width: w * .12, height: h, backgroundColor: c.ribbonColor, opacity: .4 }} />
        <Animated.View testID="envelope-flap" style={{ position: 'absolute', top: -1, left: -1, width: 0, height: 0, borderLeftWidth: w / 2, borderRightWidth: w / 2, borderTopWidth: h * .55, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: c.paperColor, transformOrigin: 'top center', transform: [{ perspective: 700 }, { rotateX: fold.interpolate({ inputRange: [0, .4, .78, 1], outputRange: ['175deg', '175deg', '0deg', '0deg'] }) }] }} />
        <View style={{ position: 'absolute', bottom: 18, right: 20, opacity: .55 }}><StoryIcon kind={c.motif === 'stars' ? 'star' : 'letter'} color={c.inkColor} size={24} /></View>
        <Animated.View testID="envelope-wax" style={{ position: 'absolute', left: w / 2 - 30, top: h * .45 - 15, opacity: fold.interpolate({ inputRange: [0, .72, .82, 1], outputRange: [0, 0, 1, 1] }), transform: [{ scale: fold.interpolate({ inputRange: [0, .72, .88, .94, 1], outputRange: [1.8, 1.8, .9, 1.04, 1] }) }] }}><WaxSeal color={c.sealColor} size={60} /></Animated.View>
      </Animated.View>
    </View>
    <View style={styles.caption}>
      <Text style={styles.presetName}>{preset.displayName}</Text><Text style={s.body}>Kept on this device, ready when you are.</Text>
      {notice && <Text role="alert" style={styles.note}>{notice}</Text>}
      {saveError && <><Text role="alert" style={styles.note}>Your latest changes are not saved yet.</Text><StoryButton label="Retry saving" onPress={() => onRetrySave?.()} secondary /></>}
      {animate ? <TextAction label="Skip sealing animation" onPress={skip} /> : <>
        <View style={styles.actions}>{onFriend && <StoryButton label="Send to a friend's gate" onPress={onFriend} disabled={saveError} />}{onSend && <StoryButton label="Let it go to the fire" onPress={onSend} disabled={saveError} secondary={Boolean(onFriend)} />}<StoryButton label="Return to my palace" onPress={onBack} secondary={Boolean(onSend || onFriend)} /><StoryButton label="Open my letter again" onPress={onUnseal} secondary /></View>
        <Text style={styles.note}>{onFriend ? 'A friend’s gate, or the quiet of the fire. You will confirm before your letter leaves.' : onSend ? 'The Burning World is ready. You’ll confirm before anything is released.' : 'A destination can wait. Your letter is not going anywhere yet.'}</Text>
      </>}
    </View>
  </StoryShell>;
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center', justifyContent: 'center', minHeight: 330, paddingVertical: 48, marginTop: 18 },
  halo: { position: 'absolute', borderWidth: 1, borderColor: '#E8DDC5', backgroundColor: 'rgba(230,216,179,.13)' },
  caption: { alignItems: 'center', gap: 14, paddingTop: 26 },
  presetName: { fontFamily: serif, color: ink, fontSize: 26 },
  actions: { gap: 13, width: '100%', maxWidth: 320, marginTop: 13 },
  note: { color: mutedInk, fontSize: 11, lineHeight: 20, textAlign: 'center', maxWidth: 350, paddingHorizontal: 8 },
});
