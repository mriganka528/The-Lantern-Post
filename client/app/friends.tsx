import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSelfProfile } from '../src/api/use-self-profile';
import { useSessionToken } from '../src/auth/use-session-token';
import { LoadingScreen } from '../src/components/auth-ui';
import { ProfileErrorScreen } from '../src/components/profile-status';
import { createFriendsTransport } from '../src/friends/friends-api';
import { FriendsHall } from '../src/friends/friends-hall';
import { friendsKey } from '../src/friends/use-friends-data';
import { NotificationSettings } from '../src/notifications/notification-settings';

export default function FriendsScreen() {
  const profile = useSelfProfile(); const router = useRouter(); const cache = useQueryClient();
  const getToken = useSessionToken(); const api = useMemo(() => createFriendsTransport(getToken), [getToken]);
  const ownerId = profile.data?.user?.id ?? '';
  useFocusEffect(useCallback(() => { if (ownerId) void cache.invalidateQueries({ queryKey: friendsKey(ownerId) }); }, [cache, ownerId]));
  if (profile.isPending) return <LoadingScreen />;
  if (profile.isError) return <ProfileErrorScreen error={profile.error} onRetry={() => { void profile.refetch(); }} />;
  if (!profile.data.user) return <Redirect href="/choose-username" />;
  if (!profile.data.user.characterId) return <Redirect href="/choose-character" />;
  return <FriendsHall key={ownerId} ownerId={ownerId} username={profile.data.user.username} api={api}
    onWrite={person => router.push({ pathname: '/writing-desk', params: { recipient: person.id } })}
    notifications={<NotificationSettings ownerId={ownerId} getToken={getToken} />}
    onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />;
}
