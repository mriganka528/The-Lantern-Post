import { useCallback, useEffect, useRef, useState } from 'react';
import type { DraftController } from '../letters/draft';
import { voiceStorage } from './voice-storage';
export function useVoiceCleanup(controller: DraftController, ownerId: string, ids: string[]) {
  const [error, setError] = useState<string | null>(null); const running = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const retry = useCallback(async () => {
    if (running.current) return; running.current = true; if (mounted.current) setError(null);
    try {
      while (controller.getSnapshot().draft?.voiceDeletes.length) {
        const id = controller.getSnapshot().draft!.voiceDeletes[0]!;
        await voiceStorage.remove(ownerId, id);
        if (!controller.finishVoiceDelete(id)) throw new Error('Cleanup could not be saved');
      }
    } catch { if (mounted.current) setError('The old recording could not be cleared from this device. Please try again.'); }
    finally { running.current = false; }
  }, [controller, ownerId]);
  const key = ids.join(',');
  useEffect(() => { if (key) void retry(); }, [key, retry]);
  return { error, retry, pending: ids.length > 0 };
}
