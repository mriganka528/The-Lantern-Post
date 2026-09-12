import { useState } from 'react';
import type { PropsWithChildren } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import type { RealmCamera } from './realm-camera';

export interface RealmViewportProps { camera: RealmCamera; height: number; }

export function RealmViewport({ camera, height, children }: PropsWithChildren<RealmViewportProps>) {
  const [responder] = useState(() => {
    const points = (event: GestureResponderEvent) => event.nativeEvent.touches.map(touch => ({ x: touch.locationX, y: touch.locationY }));
    return PanResponder.create({
      onStartShouldSetPanResponder: event => event.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponder: (event, gesture) => event.nativeEvent.touches.length >= 2 || (camera.getSnapshot().zoom > 1 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5) || Math.abs(gesture.dx) > Math.abs(gesture.dy) + 8,
      onPanResponderGrant: event => camera.begin(points(event)),
      onPanResponderStart: event => camera.begin(points(event)),
      onPanResponderMove: event => camera.move(points(event)),
      onPanResponderEnd: event => { if (event.nativeEvent.touches.length) camera.begin(points(event)); else camera.end(); },
      onPanResponderRelease: () => camera.end(),
      onPanResponderTerminate: () => camera.end(),
      onPanResponderTerminationRequest: () => false,
    });
  });
  return <View testID="realm-viewport" style={[styles.viewport, { height }]} onLayout={({ nativeEvent }) => camera.resize(nativeEvent.layout.width, nativeEvent.layout.height)} {...responder.panHandlers}>
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityRole="image" accessibilityLabel="A celestial kingdom of fire with a crowned guardian, floating temples, and an ancient altar">{children}</View>
  </View>;
}

const styles = StyleSheet.create({ viewport: { width: '100%', overflow: 'hidden', backgroundColor: '#211B27', borderWidth: 1, borderColor: '#A98B56', borderRadius: 7 } });
