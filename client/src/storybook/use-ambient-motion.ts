import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { AmbientMotionStore } from './ambient-motion-store';
import { motionStorage } from './motion-storage';
const ambientMotion = new AmbientMotionStore(motionStorage);
export function useAmbientMotion() {
  const enabled = useSyncExternalStore(ambientMotion.subscribe, ambientMotion.getSnapshot, () => true);
  useEffect(() => ambientMotion.watch(), []);
  return { enabled, setEnabled: ambientMotion.setEnabled };
}
export function useAppActive() {
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  useEffect(() => { const subscription = AppState.addEventListener('change', state => setActive(state === 'active')); return () => subscription.remove(); }, []);
  return active;
}
