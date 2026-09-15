import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { CharacterDetails, ChooseCharacterRequest, PalaceResponse, SelfResponse } from '@lantern-post/shared-types';
import { apiRequest, requestErrorMessage } from '../src/api/client';
import { charactersKey, palaceKey, useCharacters } from '../src/api/use-characters';
import { selfProfileKey, useSelfProfile } from '../src/api/use-self-profile';
import { useSessionToken } from '../src/auth/use-session-token';
import { ActionButton, AuthPage, LoadingScreen } from '../src/components/auth-ui';
import { ProfileErrorScreen, SignOutButton } from '../src/components/profile-status';
import { CharacterGallery } from '../src/storybook/character-gallery';
import { StoryDialog, s } from '../src/storybook/story-ui';

export default function ChooseCharacterScreen() {
  const profile = useSelfProfile();
  const characters = useCharacters(Boolean(profile.data?.user));
  const getToken = useSessionToken();
  const client = useQueryClient();
  const router = useRouter();
  const [account, setAccount] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const choose = useMutation({
    mutationFn: (character: CharacterDetails) => apiRequest<SelfResponse>('/users/me/character', getToken, { method: 'POST', body: { characterId: character.id } satisfies ChooseCharacterRequest }),
    onSuccess: async (response, character) => {
      if (!mounted.current) return;
      // Cancel older reads so they cannot overwrite the just-confirmed selection.
      await Promise.all([client.cancelQueries({ queryKey: selfProfileKey }), client.cancelQueries({ queryKey: palaceKey })]);
      if (!mounted.current) return;
      client.removeQueries({ queryKey: palaceKey });
      // The saved ID acknowledges this catalogue choice. Reuse that trusted
      // artwork immediately instead of another blocking palace fetch.
      if (response.user?.characterId === character.id) client.setQueryData<PalaceResponse>([...palaceKey, character.id], { character });
      client.setQueryData(selfProfileKey, response);
      // Return to the existing palace rather than replacing this screen with
      // a second palace route. Two mounted palace routes can show two gates.
      router.dismissTo('/');
    },
    onError: () => { void client.invalidateQueries({ queryKey: charactersKey }); },
  });
  if (profile.isPending) return <LoadingScreen />;
  if (profile.isError) return <ProfileErrorScreen error={profile.error} onRetry={() => { void profile.refetch(); }} />;
  if (!profile.data.user) return <Redirect href="/choose-username" />;
  if (characters.isPending) return <LoadingScreen />;
  if (characters.isError) return <ProfileErrorScreen error={characters.error} onRetry={() => { void characters.refetch(); }} />;
  if (!characters.data.characters.length) return <AuthPage title="The companions are resting" subtitle="We couldn’t find any companions just yet. Come back in a little moment."><ActionButton label="Try again" onPress={() => { void characters.refetch(); }} /><SignOutButton /></AuthPage>;

  function pick(character: CharacterDetails) {
    if (choose.isPending) return;
    if (character.id === profile.data?.user?.characterId) { router.dismissTo('/'); return; }
    choose.mutate(character);
  }
  return <View style={{ flex: 1 }}>
    <CharacterGallery characters={characters.data.characters} currentId={profile.data.user.characterId} busy={choose.isPending} error={choose.isError ? requestErrorMessage(choose.error) : null}
      onChoose={pick} onAccount={() => setAccount(true)} onBack={profile.data.user.characterId ? () => router.dismissTo('/') : undefined} />
    {account && <StoryDialog title="Your little corner" onClose={() => setAccount(false)}><Text style={s.body}>Signed in as {profile.data.user.username}</Text><SignOutButton /></StoryDialog>}
  </View>;
}
