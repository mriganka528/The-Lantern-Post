import { useCallback, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter,usePathname,useGlobalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSelfProfile } from '../api/use-self-profile';
import { useSessionToken } from '../auth/use-session-token';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import { pushDriver } from './push-driver';
import { readPush, subscribePushChange, writePush } from './push-storage';
import { friendsKey } from '../friends/use-friends-data';
import { letterboxKey } from '../letters/use-letterbox';
import { PalaceLiveSession } from '../realtime/palace-live-session';
import type { PalaceDestination } from '../realtime/palace-live-contract';
import { PalaceBellProvider } from './palace-bell-provider';

export function useNotificationSession(ownerId: string, getToken: GetSessionToken, onOpen: (destination:PalaceDestination) => void) {
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
export function NotificationSession({ children, enabled = true }: PropsWithChildren<{ enabled?: boolean }>) {
  const profile = useSelfProfile(); const getToken = useSessionToken(); const router = useRouter(); const cache = useQueryClient();
  const ownerId = enabled ? profile.data?.user?.id ?? '' : '';
  const pathname=usePathname();const params=useGlobalSearchParams<{friend?:string}>();
  const open = useCallback((destination:PalaceDestination) => { void cache.invalidateQueries({ queryKey: destination.screen === 'inbox' ? letterboxKey(ownerId) : friendsKey(ownerId) }); if(destination.screen==='chat')router.push({pathname:'/chat',params:{friend:destination.peerId}});else router.push(destination.screen === 'inbox' ? '/inbox' : '/friends'); }, [cache, ownerId, router]);
  useNotificationSession(ownerId, getToken, open);
  const chatPeerId = pathname === '/chat' && typeof params.friend === 'string' ? params.friend : undefined;
  return <PalaceBellProvider ownerId={ownerId} getToken={getToken} onOpen={open} chatPeerId={chatPeerId}><PalaceLiveSession ownerId={ownerId} getToken={getToken} onOpen={open} chatPeerId={chatPeerId}/>{children}</PalaceBellProvider>;
}
