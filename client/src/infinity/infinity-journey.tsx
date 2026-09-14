import { useEffect, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, Text, View } from 'react-native';
import type { CharacterKey, LetterPreset } from '@lantern-post/shared-types';
import { walkingArtwork } from '../storybook/artwork';
import { StoryButton, StoryHeading, StoryShell, TextAction } from '../storybook/story-ui';
import { StoryIcon } from '../storybook/ornaments';
import { useMotionPreference } from '../storybook/use-reduced-motion';
import { serif } from '../storybook/theme';
import { EnvelopeArt } from '../letters/envelope-art';
import { InfinityScenery } from './infinity-scenery';
export function InfinityJourney({ preset, courier = 'fox-lantern', preview = false, alreadyDelivered = false, onBack, onExplore, onWrite }: { preset: LetterPreset; courier?: CharacterKey; preview?: boolean; alreadyDelivered?: boolean; onBack: () => void; onExplore?: () => void; onWrite?: () => void }) {
  const [size, setSize] = useState({ width: 0, height: 0 }); const { ready, reduced } = useMotionPreference();
  return <StoryShell chapter={preview ? 'INFINITY JOURNEY PREVIEW' : 'CARRIED BEYOND THE LAST GATE'} actions={<TextAction label={preview ? 'My sealed letter' : 'My palace'} onPress={onBack} />}>
    <StoryHeading eyebrow={preview ? 'A GLIMPSE · NOTHING IS SHARED' : 'A LITTLE LIGHT IN THE INFINITY WORLD'} title={preview ? 'Beyond the gilded gate.' : 'Your letter has found its stars.'} subtitle={preview ? 'This is a preview. Your sealed letter stays on this device, and nothing is uploaded or shared.' : 'The sky has received your letter. Follow your companion through the clouds, and watch a new light rise.'} />
    <View testID="infinity-journey" onLayout={({ nativeEvent }) => setSize(old => old.width === nativeEvent.layout.width && old.height === nativeEvent.layout.height ? old : nativeEvent.layout)} style={styles.window}>
      {size.width > 0 && ready && <JourneyWorld width={size.width} height={size.height} preset={preset} courier={courier} reduced={reduced} completeInitially={alreadyDelivered && !preview} />}
    </View>
    <Text style={styles.caption}>{preview ? 'A path you can imagine. A letter that is still yours.' : 'Through pearl clouds and ancient doors, into a sky shared by all.'}</Text>
    <View style={styles.actions}>{preview ? <StoryButton label="Return to my sealed letter" onPress={onBack} /> : <><StoryButton label="Explore the Infinity World" onPress={onExplore ?? onBack} />{onWrite && <StoryButton label="Write another letter" onPress={onWrite} secondary />}<TextAction label="Return to my palace" onPress={onBack} /></>}</View>
  </StoryShell>;
}
function JourneyWorld({ width, height, preset, courier, reduced, completeInitially }: { width: number; height: number; preset: LetterPreset; courier: CharacterKey; reduced: boolean; completeInitially: boolean }) {
  const [progress] = useState(() => new Animated.Value(completeInitially ? 1 : 0)); const [step] = useState(() => new Animated.Value(0)); const [done, setDone] = useState(completeInitially); const art = walkingArtwork[courier]; const scale = Math.max(width / 1600, height / 1000);
  useEffect(() => {
    if (done) return; const options = { useNativeDriver: Platform.OS !== 'web', isInteraction: false };
    const walk = Animated.timing(progress, { ...options, toValue: 1, duration: reduced ? 0 : 7600, easing: Easing.linear });
    const gait = Animated.loop(Animated.sequence([Animated.timing(step, { ...options, toValue: 1, duration: 260 }), Animated.timing(step, { ...options, toValue: 0, duration: 260 })]));
    if (!reduced) gait.start(); walk.start(({ finished }) => { if (finished) { gait.stop(); setDone(true); } }); return () => { walk.stop(); gait.stop(); };
  }, [done, progress, reduced, step]);
  return <><View style={[{ position: 'absolute', width: 1600, height: 1000, left: (width - 1600) / 2, top: (height - 1000) / 2, transform: [{ scale }] }, { pointerEvents: "none" }]}>
    <InfinityScenery />
    {[false, true].map(right => <Animated.View key={String(right)} testID={right ? 'infinity-gate-right' : 'infinity-gate-left'} style={{ position: 'absolute', left: right ? 800 : 700, top: 330, width: 100, height: 320, transformOrigin: right ? 'right center' : 'left center', opacity: progress.interpolate({ inputRange: [0, .77, .83, 1], outputRange: [1, 1, 0, 0] }), transform: [{ perspective: 900 }, { rotateY: progress.interpolate({ inputRange: [0, .42, .8, 1], outputRange: right ? ['0deg', '0deg', '108deg', '108deg'] : ['0deg', '0deg', '-108deg', '-108deg'] }) }] }}><Image source={right ? require('../../assets/storybook/door-right.png') : require('../../assets/storybook/door-left.png')} style={StyleSheet.absoluteFill} resizeMode="stretch" /></Animated.View>)}
    <Animated.View testID="infinity-courier" style={{ position: 'absolute', width: 140, height: 164, transformOrigin: '70px 150px', transform: [{ translateX: progress.interpolate({ inputRange: [0, .16, .68, 1], outputRange: [523, 550, 721, 721] }) }, { translateY: progress.interpolate({ inputRange: [0, .68, 1], outputRange: [753, 542, 542] }) }, { scale: progress.interpolate({ inputRange: [0, .68, 1], outputRange: [1.13, .78, .78] }) }] }}>
      <Animated.Image source={art.left} style={[styles.body, { transform: [{ translateY: step.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }]} /><Animated.Image source={art.right} style={[styles.body, { transform: [{ translateY: step.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }]} /><Animated.Image source={art.body} style={[styles.body, { transform: [{ translateY: step.interpolate({ inputRange: [0, .5, 1], outputRange: [0, -3, 0] }) }] }]} />
    </Animated.View>
    <Animated.View testID="infinity-travelling-letter" style={{ position: 'absolute', opacity: progress.interpolate({ inputRange: [0, .85, 1], outputRange: [1, 1, 0] }), transform: [{ translateX: progress.interpolate({ inputRange: [0, .16, .68, .85, 1], outputRange: [623, 650, 804, 798, 780] }) }, { translateY: progress.interpolate({ inputRange: [0, .68, .85, 1], outputRange: [845, 625, 565, 305] }) }, { scale: progress.interpolate({ inputRange: [0, .68, 1], outputRange: [1, .78, .25] }) }] }}><EnvelopeArt preset={preset} width={76} /></Animated.View>
    <Animated.View testID="infinity-rising-star" style={{ position: 'absolute', left: 767, opacity: progress.interpolate({ inputRange: [0, .84, .93, 1], outputRange: [0, 0, 1, 1] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, .84, 1], outputRange: [555, 555, 251] }) }, { scale: progress.interpolate({ inputRange: [0, .84, 1], outputRange: [.3, .3, 1] }) }] }}><View style={styles.newStar}><StoryIcon kind="star" color="#987035" size={44} /></View></Animated.View>
  </View>{!done && <View style={styles.skip}><TextAction label="Skip Infinity journey" onPress={() => { progress.stopAnimation(); progress.setValue(1); setDone(true); }} /></View>}</>;
}
const styles = StyleSheet.create({ window: { height: 540, overflow: 'hidden', borderWidth: 1, borderColor: '#B9A170', borderRadius: 9, backgroundColor: '#D4CED4' }, body: { ...StyleSheet.absoluteFill, width: 140, height: 164 }, newStar: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF0C3', borderRadius: 33, borderColor: '#CEAC67', borderWidth: 1, boxShadow: '0px 0px 40px #FFF0C3' }, skip: { position: 'absolute', right: 12, bottom: 12, paddingHorizontal: 10, borderRadius: 4, backgroundColor: '#F9F0DC' }, caption: { color: '#847258', fontFamily: serif, fontSize: 17, lineHeight: 27, textAlign: 'center', marginVertical: 22 }, actions: { width: '100%', maxWidth: 370, alignSelf: 'center', gap: 14 } });
