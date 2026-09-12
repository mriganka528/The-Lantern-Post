import { useEffect, useState, useSyncExternalStore } from 'react';
import { DraftController } from './draft';
import { draftStorage } from './draft-storage';
import { randomUUID } from 'expo-crypto';

// Mount the owner-specific editor with key={profile.id}.
export function useLetterDraft(ownerId: string) {
  const [controller] = useState(() => new DraftController(ownerId, draftStorage, randomUUID));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { controller.load(); return controller.watchStorage(); }, [controller]);
  return { controller, ...snapshot };
}
