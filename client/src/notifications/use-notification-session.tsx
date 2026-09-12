import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSelfProfile } from '../api/use-self-profile';
import { useSessionToken } from '../auth/use-session-token';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import { pushDriver } from './push-driver';
import { readPush, subscribePushChange, writePush } from './push-storage';
import { friendsKey } from '../friends/use-friends-data';
import { letterboxKey } from '../letters/use-letterbox';

export function useNotificationSession(ownerId: string, getToken: GetSessionToken, onOpen: (screen: 'friends' | 'inbox') => void) {
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribePushChange(() => setRevision(value => value + 1)), []);
  useEffect(() => {
    if (!ownerId || !pushDriver.available()) return;
    let active = true; let stop: (() => void) | undefined; let refreshing = false;
    const refresh = async () => {
      if (refreshing) return; refreshing = true;
      try {
        const record = await readPush(ownerId); if (!record || !active) return;
        const token = await pushDriver.token(false); if (!active) return;
        await apiRequest('/notifications/register', getToken, { method: 'POST', body: { token, platform: Platform.OS } });
        if (!active) return;
        await writePush({ ownerId, token });
        if (!stop) { const unsubscribe = await pushDriver.listen(ownerId, screen => { if (active) onOpen(screen); }); if (!active) unsubscribe(); else stop = unsubscribe; }
      } catch { /* In-app requests keep working without push or connectivity. */ }
      finally { refreshing = false; }
    };
    void refresh(); const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { active = false; subscription.remove(); stop?.(); };
  }, [getToken, onOpen, ownerId, revision]);
}
export function NotificationSession() {
  const profile = useSelfProfile(); const getToken = useSessionToken(); const router = useRouter(); const cache = useQueryClient();
  const ownerId = profile.data?.user?.id ?? '';
  const open = useCallback((screen: 'friends' | 'inbox') => { void cache.invalidateQueries({ queryKey: screen === 'inbox' ? letterboxKey(ownerId) : friendsKey(ownerId) }); router.push(screen === 'inbox' ? '/inbox' : '/friends'); }, [cache, ownerId, router]);
  useNotificationSession(ownerId, getToken, open);
  return null;
}
