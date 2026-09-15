import { createContext, useContext, useLayoutEffect, useRef } from 'react';
import type { PropsWithChildren, RefObject } from 'react';
import { View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView, ViewProps } from 'react-native';
import type { GuidanceTargetId } from './guidance-model';

export interface GuidanceContextValue {
  active: boolean;
  scrollRef: RefObject<ScrollView | null>;
  onScroll(event: NativeSyntheticEvent<NativeScrollEvent>): void;
  register(id: GuidanceTargetId, ref: RefObject<View | null>): () => void;
  onMomentumScrollEnd(): void;
  setReady(ready: boolean): void;
  start(): void;
  preferenceError: boolean;
  retryPreference(): void;
}
export const GuidanceContext = createContext<GuidanceContextValue | null>(null);
export const useGuidance = () => useContext(GuidanceContext);

export function GuidanceTarget({ id, children, ...props }: PropsWithChildren<ViewProps & { id: GuidanceTargetId }>) {
  const guide = useGuidance();
  const register = guide?.register;
  const ref = useRef<View>(null);
  useLayoutEffect(() => register?.(id, ref), [register, id]);
  return <View {...props} nativeID={`guidance-target-${id}`} ref={ref} collapsable={false}>{children}</View>;
}
