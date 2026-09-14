import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import type { ScrollView } from 'react-native';
import type { LetterPreset } from '@lantern-post/shared-types';
import { StoryButton, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { ink, mutedInk, serif } from '../storybook/theme';
import { useMotionPreference } from '../storybook/use-reduced-motion';
import { PalaceCrest } from './antique-assets';
import { BurningRealm } from './burning-realm';
import { BURN_RITUAL_DURATION_MS } from './progressive-burn-letter';

interface BurningWorldProps {
  stage: 'confirm' | 'pending' | 'burned';
  preset: LetterPreset | null;
  busy: boolean;
  saved: boolean;
  error: string | null;
  onConfirm: () => void;
  onKeep: () => void;
  onRetry: () => void;
  onCheck: () => void;
  onCleanup: () => void;
  onBack: () => void;
  onFinish: () => void;
  onWriteAgain?: () => void;
}

export function BurningWorld({ stage, preset, busy, saved, error, onConfirm, onKeep, onRetry, onCheck, onCleanup, onBack, onFinish, onWriteAgain }: BurningWorldProps) {
  const { reduced, ready } = useMotionPreference();
  const [complete, setComplete] = useState(stage === 'burned');
  const [progress] = useState(() => new Animated.Value(stage === 'burned' ? 1 : 0));
  const [ritualStep, setRitualStep] = useState('The offering descends.');
  const scroll = useRef<ScrollView>(null);
  const sceneTop = useRef(0);
  useEffect(() => {
    if (stage !== 'burned' || !saved || !ready) return;
    // The confirm button sits below the illustration on small screens. Bring
    // the ritual into view once, while leaving subsequent exploration alone.
    const frame = requestAnimationFrame(() => scroll.current?.scrollTo({ y: Math.max(0, sceneTop.current - 12), animated: !reduced }));
    return () => cancelAnimationFrame(frame);
  }, [ready, reduced, saved, stage]);
  useEffect(() => {
    if (stage !== 'burned' || !saved || !ready || complete) return;
    const animation = Animated.timing(progress, { toValue: 1, duration: reduced ? 0 : BURN_RITUAL_DURATION_MS, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' });
    animation.start(({ finished }) => { if (finished) setComplete(true); });
    return () => animation.stop();
  }, [complete, progress, ready, reduced, saved, stage]);
  useEffect(() => {
    let previous = '';
    const listener = progress.addListener(({ value }) => {
      const label = value < .16 ? 'The offering descends.' : value < .38 ? 'The edges catch the flame.' : value < .7 ? 'The paper slowly yields.' : value < .9 ? 'A little ash. A little light.' : 'Only embers remain.';
      if (label !== previous) { previous = label; setRitualStep(label); }
    });
    return () => progress.removeListener(listener);
  }, [progress]);
  const confirmed = stage === 'burned' && saved;
  const title = stage === 'confirm' ? 'The Burning World' : stage === 'pending' ? 'Waiting for the fire…' : !saved ? 'One last little step…' : complete ? 'A little lighter, now.' : 'Let your words become light.';
  const subtitle = stage === 'confirm' ? 'Beyond the ember gates, a guardian keeps the fire for the words you are ready to release.' : stage === 'pending' ? 'We are checking your release. Nothing will be shown as burned until it is confirmed.' : !saved ? 'The fire has received your letter. We still need to finish clearing the copy on this device.' : complete ? 'Your letter is gone. Stay with the embers for a moment, then return when you are ready.' : 'Take a breath. You don’t have to carry these words any further.';
  return <StoryShell scrollRef={scroll} chapter="THE KINGDOM OF THE EVERFLAME" actions={<TextAction label={stage === 'confirm' ? 'My letter' : 'My palace'} onPress={stage === 'confirm' ? onKeep : confirmed ? onFinish : onBack} disabled={stage === 'burned' && !saved} />}>
    <StoryHeading eyebrow="CHAPTER III · BEYOND THE EMBER GATES" title={title} subtitle={subtitle} />
    <View onLayout={({ nativeEvent }) => { sceneTop.current = nativeEvent.layout.y; }}><BurningRealm progress={progress} confirmed={confirmed} preset={preset} /></View>
    <View style={styles.controls}>
      {stage === 'confirm' && <View style={styles.confirmation}>
        <PalaceCrest size={45} color="#946C40" /><Text style={styles.warningTitle}>This can’t be undone.</Text>
        <Text style={styles.warning}>Once the fire receives this letter, its words cannot be read or restored. The draft on this device will be cleared too.</Text>
        {error && <Text role="alert" style={styles.error}>{error}</Text>}
        <StoryButton label="Burn this letter" onPress={onConfirm} disabled={busy || !saved} />
        <StoryButton label="Keep my letter" onPress={onKeep} secondary />
      </View>}
      {stage === 'pending' && <View style={styles.confirmation}>
        {busy && <ActivityIndicator color="#97743F" accessibilityLabel="Checking your release" />}
        <Text style={s.body}>{busy ? 'Your sealed letter is waiting for a confirmed reply.' : 'An interrupted connection can leave the reply uncertain. Your letter stays sealed while we check.'}</Text>
        {error && <Text role="alert" style={styles.error}>{error}</Text>}
        <StoryButton label={busy ? 'Checking the release…' : 'Retry this release'} busy={busy} onPress={onRetry} />
        <TextAction label="Check release status" onPress={onCheck} disabled={busy} />
        <TextAction label="Return to my palace" onPress={onBack} />
      </View>}
      {stage === 'burned' && !saved && <View style={styles.confirmation}>
        <Text role="alert" style={styles.error}>{error ?? 'This device could not finish clearing the letter. Its words will remain hidden. Please try again.'}</Text>
        <StoryButton label="Finish clearing this letter" onPress={onCleanup} />
      </View>}
      {confirmed && <View style={{ alignItems: 'center', gap: 10 }}>
        <Text accessibilityLiveRegion="polite" style={styles.complete}>{complete ? 'Released. Nothing to carry back.' : ritualStep}</Text>
        {complete && onWriteAgain && <StoryButton label="Write another letter" onPress={onWriteAgain} />}
        <TextAction label={complete ? 'Return to my palace' : 'Skip the burn animation'} onPress={onFinish} />
      </View>}
    </View>
  </StoryShell>;
}

const styles = StyleSheet.create({
  controls: { alignItems: 'center', paddingTop: 26 },
  confirmation: { width: '100%', maxWidth: 465, backgroundColor: '#EFE4CE', borderWidth: 1, borderColor: '#C3AA7A', borderRadius: 5, padding: 23, gap: 15, alignItems: 'stretch' },
  warningTitle: { fontFamily: serif, color: ink, fontSize: 25 },
  warning: { color: '#6B5540', fontSize: 13, lineHeight: 23 },
  error: { color: '#8E4938', fontSize: 13, lineHeight: 22 },
  complete: { fontFamily: serif, fontStyle: 'italic', color: mutedInk, fontSize: 19, textAlign: 'center' },
});
