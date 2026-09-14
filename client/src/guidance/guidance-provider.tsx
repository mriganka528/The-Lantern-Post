import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren, RefObject } from 'react';
import { ScrollView, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { GuidanceContext } from './guidance-context';
import { GuidancePreference, guidanceSteps } from './guidance-model';
import type { GuidanceTargetId } from './guidance-model';
import { guidanceStorage } from './guidance-storage';
import { GuidanceOverlay } from './guidance-overlay';
import { useAppActive } from '../storybook/use-ambient-motion';
import { usePalaceModalOpen } from '../realtime/palace-live-state';

const preference = new GuidancePreference(guidanceStorage);

export function PalaceGuidanceProvider({ children, enabled = true }: PropsWithChildren<{ enabled?: boolean }>) {
  const foreground = useAppActive();
  // Our own overlay suppresses arrival popups, but must not suspend itself.
  const anotherModal = usePalaceModalOpen(true);
  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [requested, setRequested] = useState(false);
  const [preferenceError, setPreferenceError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [targets, setTargets] = useState(() => new Map<GuidanceTargetId, RefObject<View | null>>());
  const scrollRef = useRef<ScrollView>(null);
  const scrollOffset = useRef(0);
  const returnScroll = useRef(0);
  const isTour = useRef(false);
  useEffect(() => { isTour.current = index !== null; }, [index]);
  const refresh = useCallback(() => { setRevision(value => value + 1); }, []);
  const register = useCallback((id: GuidanceTargetId, ref: RefObject<View | null>) => {
    setTargets(old => new Map(old).set(id, ref));
    return () => { setTargets(old => { if (old.get(id) !== ref) return old; const next = new Map(old); next.delete(id); return next; }); };
  }, []);
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollOffset.current = event.nativeEvent.contentOffset.y;
    if (isTour.current) refresh();
  }, [refresh]);
  const start = useCallback(() => { if (enabled) setRequested(true); }, [enabled]);
  const retryPreference = useCallback(() => { setPreferenceError(!preference.retry()); }, []);
  const finish = useCallback((outcome: 'skipped' | 'complete') => {
    setPreferenceError(!preference.mark(outcome)); setRequested(false); setIndex(null);
    scrollRef.current?.scrollTo({ y: returnScroll.current, animated: false });
  }, []);
  useEffect(() => {
    if (enabled) return;
    const timer = setTimeout(() => { setIndex(null); setRequested(false); }, 0);
    return () => clearTimeout(timer);
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !foreground || !ready || anotherModal || index !== null) return;
    const timer = setTimeout(() => {
      if (requested) { returnScroll.current = scrollOffset.current; setPreferenceError(!preference.mark('seen')); setRequested(false); setIndex(0); }
      else if (preference.claimAutomatic()) { returnScroll.current = scrollOffset.current; setPreferenceError(preference.needsRetry); setIndex(0); }
    // Let the previous native account dialog finish dismissing before opening another Modal.
    }, requested ? 350 : 450);
    return () => clearTimeout(timer);
  }, [enabled, foreground, ready, anotherModal, requested, index]);
  const steps = useMemo(() => guidanceSteps.filter(step => targets.has(step.id)), [targets]);
  const current = index === null ? null : Math.min(index, steps.length - 1);
  const visible = current !== null && current >= 0 && ready && enabled && foreground && !anotherModal;
  const context = useMemo(() => ({ active: visible, scrollRef, onScroll, register, refresh, setReady, start, preferenceError, retryPreference }), [visible, onScroll, register, refresh, start, preferenceError, retryPreference]);
  return <GuidanceContext.Provider value={context}>
    {children}
    {visible && <GuidanceOverlay step={steps[current]!} index={current} total={steps.length} revision={revision} target={targets.get(steps[current]!.id)!} scrollRef={scrollRef} scrollOffset={scrollOffset}
      onSkip={() => finish('skipped')} onBack={() => setIndex(Math.max(0, current - 1))} onNext={() => { if (current === steps.length - 1) finish('complete'); else setIndex(current + 1); }} />}
  </GuidanceContext.Provider>;
}
