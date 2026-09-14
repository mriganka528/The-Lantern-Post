import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import type { CharacterKey, LetterPreset, LetterRecipient } from '@lantern-post/shared-types';
import { walkingArtwork } from '../storybook/artwork';
import { CharacterArt } from '../storybook/character-art';
import { PalaceScene } from '../storybook/palace-scene';
import { StoryHeading, StoryShell, TextAction } from '../storybook/story-ui';
import { useMotionPreference } from '../storybook/use-reduced-motion';
import { mutedInk, serif } from '../storybook/theme';
import { EnvelopeArt } from './envelope-art';
import { RoyalNameplate } from '../storybook/royal-nameplate';

export function DeliveryJourney({ recipient, preset, courier, preview = false, alreadyDelivered = false, onFinish }: { recipient: LetterRecipient; preset: LetterPreset; courier?: CharacterKey; preview?: boolean; alreadyDelivered?: boolean; onFinish: () => void }) {
  const { reduced, ready } = useMotionPreference(); const [laidOut, setLaidOut] = useState(false);
  const [progress] = useState(() => new Animated.Value(alreadyDelivered && !preview ? 1 : 0));
  const [step] = useState(() => new Animated.Value(0)); const [complete, setComplete] = useState(alreadyDelivered && !preview);
  const native = Platform.OS !== 'web';
  useEffect(() => {
    if (!ready || !laidOut || complete) return;
    const walk = Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : 4200, easing: Easing.linear, useNativeDriver: native });
    const gait = Animated.loop(Animated.sequence([Animated.timing(step, { toValue: 1, duration: 250, easing: Easing.inOut(Easing.sin), useNativeDriver: native }), Animated.timing(step, { toValue: 0, duration: 250, easing: Easing.inOut(Easing.sin), useNativeDriver: native })]));
    if (!reduced) gait.start(); walk.start(({ finished }) => { if (finished) { gait.stop(); setComplete(true); } });
    return () => { walk.stop(); gait.stop(); };
  }, [complete, laidOut, native, progress, ready, reduced, step]);
  const art = courier ? walkingArtwork[courier] : null;
  return <StoryShell chapter={preview ? 'A GLIMPSE OF THE JOURNEY' : 'CARRIED THROUGH THE CLOUDS'} actions={<TextAction label={preview ? 'Back to my letter' : 'My palace'} onPress={onFinish} />}>
    <StoryHeading eyebrow={preview ? 'PREVIEW · YOUR LETTER STAYS HERE' : 'THE PRIVATE PALACE POST'} title={preview ? `The path to ${recipient.username}.` : complete ? 'A little light, delivered.' : `On the way to ${recipient.username}.`} subtitle={preview ? 'This is a preview of the journey. Your letter remains sealed on this device; nothing is sent.' : `Your sealed words have reached ${recipient.palaceName || `${recipient.username}’s gate`}. Take a moment to follow their journey.`} />
    <View testID="delivery-journey">
      <PalaceScene characterKey={recipient.characterKey ?? 'fox-lantern'} worldOverlay={<View onLayout={() => setLaidOut(true)} style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
        <View style={styles.gateway}><View style={styles.gatewayLight} /><View style={styles.gateName}><RoyalNameplate username={recipient.username}/></View>
          {recipient.characterKey && <View style={{ position: 'absolute', bottom: 9, alignSelf: 'center' }}><CharacterArt characterKey={recipient.characterKey} size={108} /></View>}
          <Animated.View testID="delivery-gate-left" style={[styles.door, { left: 8, transformOrigin: 'left center', opacity: progress.interpolate({ inputRange: [0, .7, .8, 1], outputRange: [1, 1, 0, 0] }), transform: [{ perspective: 900 }, { rotateY: progress.interpolate({ inputRange: [0, .45, .77, 1], outputRange: ['0deg', '0deg', '-105deg', '-105deg'] }) }] }]}><Image source={require('../../assets/storybook/door-left.png')} style={styles.fill} resizeMode="stretch" /></Animated.View>
          <Animated.View style={[styles.door, { right: 8, transformOrigin: 'right center', opacity: progress.interpolate({ inputRange: [0, .7, .8, 1], outputRange: [1, 1, 0, 0] }), transform: [{ perspective: 900 }, { rotateY: progress.interpolate({ inputRange: [0, .45, .77, 1], outputRange: ['0deg', '0deg', '105deg', '105deg'] }) }] }]}><Image source={require('../../assets/storybook/door-right.png')} style={styles.fill} resizeMode="stretch" /></Animated.View>
        </View>
        <Animated.View testID="delivery-courier" style={{ position: 'absolute', left: 0, top: 0, width: 140, height: 164, transformOrigin: '70px 150px', transform: [
          { translateX: progress.interpolate({ inputRange: [0, .12, .45, .75, 1], outputRange: [356, 356, 437, 504, 504] }) },
          { translateY: progress.interpolate({ inputRange: [0, .12, .45, .75, 1], outputRange: [480, 480, 450, 425, 425] }) },
          { scale: progress.interpolate({ inputRange: [0, .75, 1], outputRange: [1, .72, .72] }) },
        ] }}>
          <View style={styles.shadow} />
          {art ? <><Animated.Image source={art.left} style={[styles.fill, { transform: [{ translateY: step.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }, { rotate: step.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] }) }] }]} /><Animated.Image source={art.right} style={[styles.fill, { transform: [{ translateY: step.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }, { rotate: step.interpolate({ inputRange: [0, 1], outputRange: ['7deg', '-7deg'] }) }] }]} /><Animated.Image source={art.body} style={[styles.fill, { transform: [{ translateY: step.interpolate({ inputRange: [0, .5, 1], outputRange: [0, -3, 0] }) }] }]} /></> : <Image source={require('../../assets/storybook/lantern.png')} style={styles.fill} resizeMode="contain" />}
        </Animated.View>
        <Animated.View testID="travelling-letter" style={{ position: 'absolute', left: 0, top: 0, transform: [
          { translateX: progress.interpolate({ inputRange: [0, .12, .45, .75, .95, 1], outputRange: [446, 446, 516, 574, 582, 582] }) },
          { translateY: progress.interpolate({ inputRange: [0, .12, .45, .75, .95, 1], outputRange: [566, 566, 531, 493, 551, 551] }) },
          { scale: progress.interpolate({ inputRange: [0, .75, 1], outputRange: [1, .74, .74] }) },
          { rotate: progress.interpolate({ inputRange: [0, .75, 1], outputRange: ['-9deg', '-3deg', '0deg'] }) },
        ] }}><EnvelopeArt preset={preset} width={65} /></Animated.View>
      </View>} />
    </View>
    <Text accessibilityLiveRegion="polite" style={styles.caption}>{preview ? complete ? 'A glimpse of the path. Your letter is still yours.' : 'A little walk across the river, towards a familiar gate…' : complete ? 'Delivered privately. Only your two palaces can open this letter.' : 'Delivered. Through the garden, into a friend’s keeping.'}</Text>
    <View style={{ alignItems: 'center' }}><TextAction label={preview ? 'Return to my sealed letter' : complete ? 'Return to my palace' : 'Skip delivery animation'} onPress={onFinish} /></View>
  </StoryShell>;
}
const styles = StyleSheet.create({
  gateway: { position: 'absolute', left: 523, top: 411, width: 170, height: 180, borderWidth: 3, borderColor: '#B99B69', borderTopLeftRadius: 86, borderTopRightRadius: 86, backgroundColor: '#E4D3AE' }, gatewayLight: { position: 'absolute', left: 8, right: 8, top: 11, bottom: 0, backgroundColor: '#FCF2CE', borderTopLeftRadius: 73, borderTopRightRadius: 73 },
  gateName: { position: 'absolute', left: -44, right: -44, top: -55, alignItems:'center' }, door: { position: 'absolute', top: 9, bottom: 0, width: 74, backfaceVisibility: 'hidden' }, fill: { position: 'absolute', width: '100%', height: '100%' }, shadow: { position: 'absolute', left: 35, top: 143, width: 70, height: 10, backgroundColor: 'rgba(76,65,44,.18)', borderRadius: 40 }, caption: { color: mutedInk, fontFamily: serif, fontStyle: 'italic', fontSize: 18, lineHeight: 27, textAlign: 'center', marginVertical: 23 },
});
