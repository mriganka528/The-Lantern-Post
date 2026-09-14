import { useEffect, useState, useSyncExternalStore } from 'react';
import { DraftController } from './draft';
import { draftStorage } from './draft-storage';
import { randomUUID } from 'expo-crypto';

// Mount the owner-specific editor with key={profile.id}.
export function useLetterDraft(ownerId: string, supplied?: DraftController) {
  const [controller] = useState(() => supplied ?? new DraftController(ownerId, draftStorage, randomUUID));
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => { if (supplied) controller.load(); else controller.openDesk(); return controller.watchStorage(); }, [controller, supplied]);
  return { controller, ...snapshot };
}
