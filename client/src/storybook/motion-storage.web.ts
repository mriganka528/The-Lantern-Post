import type { MotionStorage } from './ambient-motion-store';
const key = 'lantern-ambient-motion-v1';
export const motionStorage: MotionStorage = {
  read: () => typeof window === 'undefined' ? null : window.localStorage.getItem(key),
  write: value => window.localStorage.setItem(key, value),
  subscribe: listener => { const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) listener(); }; window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage); },
};
