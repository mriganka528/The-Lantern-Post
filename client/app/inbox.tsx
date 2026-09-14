import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSelfProfile } from '../src/api/use-self-profile';
import { useSessionToken } from '../src/auth/use-session-token';
import { LoadingScreen } from '../src/components/auth-ui';
import { ProfileErrorScreen } from '../src/components/profile-status';
import { createLetterBoxTransport } from '../src/letters/friend-letter-api';
import { PalaceLetterbox } from '../src/letters/letterbox';
import { letterboxKey } from '../src/letters/use-letterbox';
import { createSafetyTransport } from '../src/safety/safety-api';

export default function InboxScreen() {
  const profile = useSelfProfile(); const router = useRouter(); const cache = useQueryClient(); const getToken = useSessionToken();
  const api = useMemo(() => createLetterBoxTransport(getToken), [getToken]); const ownerId = profile.data?.user?.id ?? '';
  const safety = useMemo(() => createSafetyTransport(getToken), [getToken]);
  useFocusEffect(useCallback(() => { if (ownerId) void cache.invalidateQueries({ queryKey: letterboxKey(ownerId) }); }, [cache, ownerId]));
  if (profile.isPending) return <LoadingScreen />;
  if (profile.isError) return <ProfileErrorScreen error={profile.error} onRetry={() => { void profile.refetch(); }} />;
  if (!profile.data.user) return <Redirect href="/choose-username" />;
  if (!profile.data.user.characterId) return <Redirect href="/choose-character" />;
  return <PalaceLetterbox key={ownerId} ownerId={ownerId} api={api} safety={safety} onBack={() => router.replace('/')} onWrite={() => router.push('/writing-desk')} onReply={person => router.push({ pathname: '/writing-desk', params: { recipient: person.id } })} />;
}
