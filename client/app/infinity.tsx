import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSelfProfile } from '../src/api/use-self-profile';
import { useSessionToken } from '../src/auth/use-session-token';
import { LoadingScreen } from '../src/components/auth-ui';
import { ProfileErrorScreen } from '../src/components/profile-status';
import { createInfinityTransport } from '../src/infinity/infinity-api';
import { createSafetyTransport } from '../src/safety/safety-api';
import { InfinityWorld, infinityKey } from '../src/infinity/infinity-world';
export default function InfinityScreen() {
  const profile = useSelfProfile(); const token = useSessionToken(); const router = useRouter(); const cache = useQueryClient(); const ownerId = profile.data?.user?.id ?? '';
  const [visit, setVisit] = useState(0);
  const api = useMemo(() => createInfinityTransport(token), [token]); const safety = useMemo(() => createSafetyTransport(token), [token]);
  // A route can stay mounted in the navigation stack. A new focused visit must
  // still begin at night; ordinary scene renders and view changes keep its state.
  useFocusEffect(useCallback(() => { if (ownerId) { setVisit(value => value + 1); void cache.resetQueries({ queryKey: infinityKey(ownerId) }); } }, [cache, ownerId]));
  if (profile.isPending) return <LoadingScreen />; if (profile.isError) return <ProfileErrorScreen error={profile.error} onRetry={() => { void profile.refetch(); }} />;
  if (!profile.data.user) return <Redirect href="/choose-username" />; if (!profile.data.user.characterId) return <Redirect href="/choose-character" />;
  return <InfinityWorld key={`${ownerId}:${visit}`} ownerId={ownerId} api={api} safety={safety} onBack={() => router.replace('/')} onWrite={() => router.push('/writing-desk')} />;
}
