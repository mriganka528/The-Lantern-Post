import { useEffect, useState, useSyncExternalStore } from 'react';
import type { PropsWithChildren } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { RealmCamera, realmScale, REALM_HEIGHT, REALM_WIDTH, MAX_REALM_ZOOM, MIN_REALM_ZOOM } from './realm-camera';
import { RealmViewport } from './realm-viewport';
import { useReducedMotion } from '../storybook/use-reduced-motion';
import { serif } from '../storybook/theme';

export function ZoomableRealm({ children, height }: PropsWithChildren<{ height: number }>) {
  const [camera] = useState(() => new RealmCamera());
  const view = useSyncExternalStore(camera.subscribe, camera.getSnapshot, camera.getSnapshot);
  const reduced = useReducedMotion();
  const [values] = useState(() => ({ zoom: new Animated.Value(1), x: new Animated.Value(0), y: new Animated.Value(0) }));
  useEffect(() => {
    const duration = view.animate && !reduced ? 180 : 0;
    const movement = Animated.parallel([
      Animated.timing(values.zoom, { toValue: view.zoom, duration, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(values.x, { toValue: view.x, duration, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(values.y, { toValue: view.y, duration, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }),
    ]);
    movement.start(); return () => movement.stop();
  }, [reduced, values, view]);
  return <View style={styles.outer}>
    <View style={styles.toolbar}>
      <View style={styles.buttons}>
        <CameraButton label="Zoom out" text="−" onPress={() => camera.zoomBy(-.25)} disabled={view.zoom <= MIN_REALM_ZOOM} />
        <Text testID="realm-zoom-level" accessibilityLabel={`Zoom ${Math.round(view.zoom * 100)} percent`} style={styles.level}>{Math.round(view.zoom * 100)}%</Text>
        <CameraButton label="Zoom in" text="+" onPress={() => camera.zoomBy(.25)} disabled={view.zoom >= MAX_REALM_ZOOM} />
        <CameraButton label="Reset world view" text="Reset" onPress={() => camera.reset()} />
      </View>
      <View style={styles.buttons}>
        <CameraButton label="Focus on the fire guardian" text="The guardian" onPress={() => camera.focus({ x: 800, y: 345 }, 1.8)} />
        <CameraButton label="Focus on the letter" text="The letter" onPress={() => camera.focus({ x: 800, y: 675 }, 2.35)} />
      </View>
    </View>
    <RealmViewport camera={camera} height={height}>
      {view.width > 1 && <Animated.View testID="realm-camera" style={{ position: 'absolute', width: REALM_WIDTH, height: REALM_HEIGHT, left: (view.width - REALM_WIDTH) / 2, top: (view.height - REALM_HEIGHT) / 2,
        transform: [{ translateX: values.x }, { translateY: values.y }, { scale: Animated.multiply(values.zoom, realmScale(view.width, view.height)) }],
      }}>{children}</Animated.View>}
    </RealmViewport>
    <Text style={styles.hint}>{Platform.OS === 'web' ? 'Drag to explore · Pinch or Ctrl + scroll to zoom · + / − and arrow keys work here, too' : 'Pinch to zoom · Drag to explore when zoomed in'}</Text>
  </View>;
}

function CameraButton({ label, text, onPress, disabled = false }: { label: string; text: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} aria-disabled={disabled} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, (disabled || pressed) && { opacity: .45 }]}><Text style={styles.buttonText}>{text}</Text></Pressable>;
}
const styles = StyleSheet.create({
  outer: { width: '100%' }, toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 },
  buttons: { flexDirection: 'row', alignItems: 'center', gap: 7 }, button: { minHeight: 44, minWidth: 44, borderWidth: 1, borderColor: '#C4AD7D', borderRadius: 4, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0E6D0' },
  buttonText: { fontFamily: serif, fontSize: 15, color: '#695137' }, level: { fontSize: 11, color: '#78694E', minWidth: 39, textAlign: 'center' },
  hint: { color: '#807059', fontSize: 10, lineHeight: 18, textAlign: 'center', paddingTop: 9, paddingHorizontal: 8 },
});
