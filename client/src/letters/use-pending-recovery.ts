import { useEffect } from 'react';
import { useAppActive } from '../storybook/use-ambient-motion';
import { RecoveryScheduler } from './recovery-scheduler';
import type { RecoveryWork } from './recovery-scheduler';
import { recoveryOnline, watchRecoveryNetwork } from './recovery-network';
export function usePendingRecovery(work: RecoveryWork, identity: string | null) {
  const active = useAppActive();
  useEffect(() => {
    if (!active || !identity) return;
    const scheduler = new RecoveryScheduler(work); let disposed = false; let attempts = 0; let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => { clearTimeout(timer); if (disposed || !recoveryOnline()) return; attempts = Math.min(6, attempts + 1); await scheduler.resume(); if (!disposed && work.identity()) timer = setTimeout(() => { void run(); }, Math.min(60000, 5000 * 2 ** attempts)); };
    const reconnect = () => { attempts = 0; void run(); };
    const unwatch = watchRecoveryNetwork(reconnect); timer = setTimeout(() => { void run(); }, 5000);
    return () => { disposed = true; clearTimeout(timer); scheduler.stop(); unwatch(); };
  }, [active, identity, work]);
}
