import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { View } from 'react-native';
import { usePalace } from '../src/api/use-characters';
import { useSelfProfile } from '../src/api/use-self-profile';
import { ActionButton, AuthPage, LoadingScreen } from '../src/components/auth-ui';
import { requestErrorMessage } from '../src/api/client';
import { ProfileErrorScreen, SignOutButton } from '../src/components/profile-status';
import { PalaceHome } from '../src/storybook/palace-home';
import { useSessionToken } from '../src/auth/use-session-token';
import { createFriendsTransport } from '../src/friends/friends-api';
import { friendsKey, useFriendsList, useFriendsSummary } from '../src/friends/use-friends-data';
import { createLetterBoxTransport } from '../src/letters/friend-letter-api';
import { letterboxKey, useLetterboxSummary } from '../src/letters/use-letterbox';
import { AccountMenu } from '../src/account/account-menu';
import { PalaceGuidanceProvider } from '../src/guidance/guidance-provider';

export default function HomeScreen() {
  const profile = useSelfProfile();
  const palace = usePalace(profile.data?.user?.characterId ?? null);
  const router = useRouter();
  const [account, setAccount] = useState(false);
  const [focused, setFocused] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const getToken = useSessionToken(); const cache = useQueryClient();
  const friendsApi = useMemo(() => createFriendsTransport(getToken), [getToken]);
  const letterboxApi = useMemo(() => createLetterBoxTransport(getToken), [getToken]);
  const ownerId = profile.data?.user?.id ?? '';
  const friendSummary = useFriendsSummary(friendsApi, ownerId, Boolean(profile.data?.user?.characterId));
  const friends = useFriendsList(friendsApi, ownerId, 'friends', Boolean(profile.data?.user?.characterId));
  const letterbox = useLetterboxSummary(letterboxApi, ownerId, Boolean(profile.data?.user?.characterId));
  useFocusEffect(useCallback(() => { if (ownerId) { void cache.invalidateQueries({ queryKey: friendsKey(ownerId) }); void cache.invalidateQueries({ queryKey: letterboxKey(ownerId) }); } }, [cache, ownerId]));
  if (profile.isPending) return <LoadingScreen />;
  if (profile.isError) return <ProfileErrorScreen error={profile.error} onRetry={() => { void profile.refetch(); }} />;
  if (!profile.data.user) return <Redirect href="/choose-username" />;
  if (!profile.data.user.characterId) return <Redirect href="/choose-character" />;
  if (palace.isPending) return <LoadingScreen />;
  if (palace.isError) return <AuthPage title="Your palace is just beyond the mist" subtitle={requestErrorMessage(palace.error)}>
    <ActionButton label="Try again" onPress={() => { void palace.refetch(); }} /><ActionButton label="Choose a companion" secondary onPress={() => router.push('/choose-character')} /><SignOutButton />
  </AuthPage>;
  if (!palace.data.character) return <Redirect href="/choose-character" />;
  return <PalaceGuidanceProvider key={ownerId} enabled={focused}><View style={{ flex: 1 }}>
    <PalaceHome key={palace.data.character.id} character={palace.data.character} username={profile.data.user.username} onCompanions={() => router.push('/choose-character')} onAccount={() => setAccount(true)} onWrite={() => router.push('/writing-desk')} onInfinity={() => router.push('/infinity')}
      onFriends={() => router.push('/friends')} friends={friends.data?.pages.flatMap(page => page.items)} friendSummary={friendSummary.data} friendsUnavailable={friends.isError || friendSummary.isError}
      onInbox={() => router.push('/inbox')} unreadLetters={letterbox.data?.unread} onWriteToFriend={person => router.push({ pathname: '/writing-desk', params: { recipient: person.id } })} onChatToFriend={person => router.push({ pathname: '/chat', params: { friend: person.id } })} />
    {account && <AccountMenu ownerId={ownerId} username={profile.data.user.username} getToken={getToken} onClose={() => setAccount(false)} onPrivacy={() => { setAccount(false); router.push('/privacy'); }} signOut={<SignOutButton />} />}
  </View></PalaceGuidanceProvider>;
}
