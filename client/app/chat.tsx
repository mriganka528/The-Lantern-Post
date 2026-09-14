import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useSelfProfile } from '../src/api/use-self-profile';
import { useSessionToken } from '../src/auth/use-session-token';
import { AuthPage, ActionButton, LoadingScreen } from '../src/components/auth-ui';
import { ProfileErrorScreen } from '../src/components/profile-status';
import { createChatTransport } from '../src/chat/chat-api';
import { ChatRoom } from '../src/chat/chat-room';
import { createSafetyTransport } from '../src/safety/safety-api';
export default function ChatScreen() {
  const { friend } = useLocalSearchParams<{ friend?: string }>(); const profile = useSelfProfile(); const token = useSessionToken(); const router = useRouter(); const [focused, setFocused] = useState(false);
  const api = useMemo(() => createChatTransport(token), [token]); const safety = useMemo(() => createSafetyTransport(token), [token]);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const back = () => { if (router.canGoBack()) router.back(); else router.replace('/friends'); };
  if (profile.isPending) return <LoadingScreen />;
  if (profile.isError) return <ProfileErrorScreen error={profile.error} onRetry={() => { void profile.refetch(); }} />;
  if (!profile.data.user) return <Redirect href="/choose-username" />;
  if (!profile.data.user.characterId) return <Redirect href="/choose-character" />;
  if (typeof friend !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(friend)) return <AuthPage title="Choose a friendship gate" subtitle="Open the parlour from a friend's accepted gate."><ActionButton label="Friendship court" onPress={back} /></AuthPage>;
  return <ChatRoom key={profile.data.user.id + ':' + friend} ownerId={profile.data.user.id} peerId={friend} api={api} safety={safety} focused={focused} onBack={back} />;
}
