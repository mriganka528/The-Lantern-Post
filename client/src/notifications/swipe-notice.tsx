import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, View } from 'react-native';
import { StoryIcon } from '../storybook/ornaments';
import { useReducedMotion } from '../storybook/use-reduced-motion';
import { isNoticeSwipe, shouldDismissNotice } from './notice-swipe';

class NoticeSwipeController {
  readonly offset = new Animated.Value(0);
  width = 320; reduced = true; active = true; animating = false;
  dismiss: () => boolean = () => false;
  readonly responder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, state) => this.active && !this.animating && isNoticeSwipe(state.dx, state.dy),
    onPanResponderMove: (_event, state) => this.offset.setValue(state.dx),
    onPanResponderRelease: (_event, state) => {
      if (!shouldDismissNotice(state.dx, state.dy, state.vx, this.width)) { this.offset.setValue(0); return; }
      this.animating = true;
      Animated.timing(this.offset, { toValue: Math.sign(state.dx) * (this.width + 20), duration: this.reduced ? 0 : 150, useNativeDriver: Platform.OS !== 'web' }).start(({ finished }) => {
        if (finished && this.active && !this.dismiss()) this.offset.setValue(0);
        this.animating = false;
      });
    },
    onPanResponderTerminate: () => { this.animating = false; this.offset.setValue(0); },
  });
  configure(dismiss: () => boolean, reduced: boolean) { this.dismiss = dismiss; this.reduced = reduced; }
  mount() { this.active = true; }
  resize(width: number) { this.width = width; }
  dispose() { this.active = false; this.offset.stopAnimation(); }
}
export function SwipeNotice({ children, label, onDismiss }: PropsWithChildren<{ label: string; onDismiss(): boolean }>) {
  const [swipe] = useState(() => new NoticeSwipeController()); const reduced = useReducedMotion();
  useEffect(() => { swipe.configure(onDismiss, reduced); }, [swipe,onDismiss,reduced]);
  useEffect(() => { swipe.mount(); return () => swipe.dispose(); }, [swipe]);
  return <View style={styles.clip} onLayout={event => { swipe.resize(event.nativeEvent.layout.width); }}>
    <Animated.View {...swipe.responder.panHandlers} style={{ transform: [{ translateX: swipe.offset }] }}>
      {children}
      <Pressable accessibilityRole="button" accessibilityLabel={`Dismiss notification: ${label}`} onPress={() => { swipe.dismiss(); }} style={styles.dismiss}><StoryIcon kind="close" size={16} color="#8A7150" /></Pressable>
    </Animated.View>
  </View>;
}
const styles = StyleSheet.create({ clip: { overflow: 'hidden', borderRadius: 6 }, dismiss: { position: 'absolute', top: 3, right: 3, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' } });
