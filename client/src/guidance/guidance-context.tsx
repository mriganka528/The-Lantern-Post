import { createContext, useCallback, useContext, useLayoutEffect, useRef } from 'react';
import type { PropsWithChildren, RefObject } from 'react';
import { View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView, ViewProps } from 'react-native';
import type { GuidanceTargetId } from './guidance-model';

export interface GuidanceContextValue {
  active: boolean;
  scrollRef: RefObject<ScrollView | null>;
  onScroll(event: NativeSyntheticEvent<NativeScrollEvent>): void;
  register(id: GuidanceTargetId, ref: RefObject<View | null>): () => void;
  refresh(): void;
  setReady(ready: boolean): void;
  start(): void;
  preferenceError: boolean;
  retryPreference(): void;
}
export const GuidanceContext = createContext<GuidanceContextValue | null>(null);
export const useGuidance = () => useContext(GuidanceContext);

export function GuidanceTarget({ id, children, onLayout, ...props }: PropsWithChildren<ViewProps & { id: GuidanceTargetId }>) {
  const guide = useGuidance();
  const register = guide?.register, refresh = guide?.refresh;
  const ref = useRef<View>(null);
  useLayoutEffect(() => register?.(id, ref), [register, id]);
  const layout = useCallback<NonNullable<ViewProps['onLayout']>>(event => { onLayout?.(event); refresh?.(); }, [onLayout, refresh]);
  return <View {...props} nativeID={`guidance-target-${id}`} ref={ref} collapsable={false} onLayout={layout}>{children}</View>;
}
