import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useSelfProfile } from '../src/api/use-self-profile';
import { usePresets } from '../src/api/use-presets';
import { LoadingScreen } from '../src/components/auth-ui';
import { ProfileErrorScreen } from '../src/components/profile-status';
import { WritingDesk } from '../src/letters/writing-desk';
import { useSessionToken } from '../src/auth/use-session-token';
import { createBurnTransport } from '../src/letters/burn-api';
import { createDeliveryTransport } from '../src/letters/friend-letter-api';
import { createFriendsTransport } from '../src/friends/friends-api';
import { usePalace } from '../src/api/use-characters';

export default function WritingDeskScreen() {
  const profile = useSelfProfile();
  const palace = usePalace(profile.data?.user?.characterId ?? null);
  const params = useLocalSearchParams<{ recipient?: string }>();
  const presets = usePresets(Boolean(profile.data?.user?.characterId));
  const router = useRouter();
  const getToken = useSessionToken();
  const burnTransport = useMemo(() => createBurnTransport(getToken), [getToken]);
  const deliveryTransport = useMemo(() => createDeliveryTransport(getToken), [getToken]);
  const friendsTransport = useMemo(() => createFriendsTransport(getToken), [getToken]);
  if (profile.isPending) return <LoadingScreen />;
  if (profile.isError) return <ProfileErrorScreen error={profile.error} onRetry={() => { void profile.refetch(); }} />;
  if (!profile.data.user) return <Redirect href="/choose-username" />;
  if (!profile.data.user.characterId) return <Redirect href="/choose-character" />;
  return <WritingDesk key={profile.data.user.id} ownerId={profile.data.user.id} presets={presets.data?.presets ?? []} burnTransport={burnTransport}
    deliveryTransport={deliveryTransport} friendsTransport={friendsTransport} characterKey={palace.data?.character?.key} initialRecipientId={typeof params.recipient === 'string' ? params.recipient : undefined} onFriends={() => router.push('/friends')}
    catalogUnavailable={presets.isError || (!presets.isPending && !presets.data?.presets.length)} refreshing={presets.isFetching}
    onRetryCatalog={() => { void presets.refetch(); }} onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />;
}
