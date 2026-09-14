import { useCallback, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { PanResponder, StyleSheet, View } from 'react-native';
import type { GestureResponderEvent } from 'react-native';
import type { RealmCamera } from './realm-camera';

export interface RealmViewportProps { camera: RealmCamera; height: number; interactive?: boolean; label?: string; }

class TouchViewport {
  private element: View | null = null;
  private origin = { x: 0, y: 0 };
  private generation = 0;
  readonly responder;
  constructor(private readonly camera: RealmCamera) {
    const points = (event: GestureResponderEvent) => event.nativeEvent.touches.map(touch => ({ x: touch.pageX - this.origin.x, y: touch.pageY - this.origin.y }));
    const begin = (event: GestureResponderEvent) => {
      const generation = ++this.generation;
      const touches = event.nativeEvent.touches.map(touch => ({ x: touch.pageX, y: touch.pageY }));
      this.element?.measureInWindow((x, y) => { if (this.generation !== generation) return; this.origin = { x, y }; camera.begin(touches.map(touch => ({ x: touch.x - x, y: touch.y - y }))); });
    };
    this.responder = PanResponder.create({
      onStartShouldSetPanResponder: event => event.nativeEvent.touches.length >= 2,
      onMoveShouldSetPanResponder: (event, gesture) => event.nativeEvent.touches.length >= 2 || (camera.getSnapshot().zoom > 1 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5) || Math.abs(gesture.dx) > Math.abs(gesture.dy) + 8,
      onPanResponderGrant: begin,
      onPanResponderStart: begin,
      onPanResponderMove: event => camera.move(points(event)),
      onPanResponderEnd: event => { this.generation++; if (event.nativeEvent.touches.length) camera.begin(points(event)); else camera.end(); },
      onPanResponderRelease: () => this.end(),
      onPanResponderTerminate: () => this.end(),
      onPanResponderTerminationRequest: () => false,
    });
  }
  private end() { this.generation++; this.camera.end(); }
  attach = (node: View | null) => { this.element = node; if (!node) this.end(); };
  resize(width: number, height: number) { this.camera.resize(width, height); this.element?.measureInWindow((x, y) => { this.origin = { x, y }; }); }
}
export function RealmViewport({ camera, height, children, interactive = false, label = 'A celestial kingdom of fire with a crowned guardian, floating temples, and an ancient altar' }: PropsWithChildren<RealmViewportProps>) {
  const [viewport] = useState(() => new TouchViewport(camera));
  const attach = useCallback((node: View | null) => { viewport.attach(node); }, [viewport]);
  return <View ref={attach} testID="realm-viewport" style={[styles.viewport, { height }]} onLayout={({ nativeEvent }) => viewport.resize(nativeEvent.layout.width, nativeEvent.layout.height)} {...viewport.responder.panHandlers}>
    <View style={[StyleSheet.absoluteFill, { pointerEvents: interactive ? 'auto' : 'none' }]} accessibilityRole={interactive ? undefined : 'image'} accessibilityLabel={interactive ? undefined : label}>{children}</View>
  </View>;
}

const styles = StyleSheet.create({ viewport: { width: '100%', overflow: 'hidden', backgroundColor: '#211B27', borderWidth: 1, borderColor: '#A98B56', borderRadius: 7 } });
