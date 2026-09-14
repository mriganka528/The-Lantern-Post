import { useEffect } from 'react';
import { CabinetCleanup } from './cabinet-cleanup';
import { draftStorage } from './draft-storage';
import { voiceStorage } from '../voice/voice-storage';
import { useAppActive } from '../storybook/use-ambient-motion';
export function useCabinetCleanup(ownerId: string, activeKey: string) {
  const active = useAppActive();
  useEffect(() => { if (!active) return; const cleanup = new CabinetCleanup(ownerId, activeKey, draftStorage, voiceStorage.remove); return cleanup.start(); }, [active, activeKey, ownerId]);
}
