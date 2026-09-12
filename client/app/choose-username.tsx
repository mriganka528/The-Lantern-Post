import { useAuth, useUser } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProfileRequest, SelfResponse, UsernameAvailabilityResponse } from '@lantern-post/shared-types';
import { Redirect, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { apiRequest, requestErrorMessage } from '../src/api/client';
import { selfProfileKey, useSelfProfile } from '../src/api/use-self-profile';
import { useOnboardingDraft } from '../src/auth/onboarding-store';
import { useSessionToken } from '../src/auth/use-session-token';
import { ActionButton, AgeConfirmation, AuthPage, FormError, LoadingScreen, styles } from '../src/components/auth-ui';
import { ProfileErrorScreen, SignOutButton } from '../src/components/profile-status';

export default function ChooseUsernameScreen() {
  const getToken = useSessionToken();
  const { isLoaded: userLoaded, user } = useUser();
  const { sessionId } = useAuth();
  const profile = useSelfProfile();
  const client = useQueryClient();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [debouncedUsername, setDebouncedUsername] = useState('');
  const [ageChecked, setAgeChecked] = useState(false);
  const mounted = useRef(true);
  const confirmedEmail = useOnboardingDraft((state) => state.ageConfirmedForEmail);
  const confirmedSession = useOnboardingDraft((state) => state.ageConfirmedForSessionId);
  const email = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase();
  const confirmedBeforeSignup = Boolean((email && confirmedEmail === email) || (sessionId && confirmedSession === sessionId));
  const minimumAgeConfirmed = confirmedBeforeSignup || ageChecked;
  const canonicalUsername = username.trim().toLowerCase();
  const validUsername = /^[a-z0-9_]{3,24}$/.test(canonicalUsername);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedUsername(validUsername ? canonicalUsername : ''), 350);
    return () => clearTimeout(timer);
  }, [canonicalUsername, validUsername]);

  const availability = useQuery({
    queryKey: ['username-availability', debouncedUsername],
    enabled: Boolean(profile.data && !profile.data.user && validUsername && debouncedUsername === canonicalUsername),
    staleTime: 0,
    queryFn: ({ signal }) => apiRequest<UsernameAvailabilityResponse>(`/users/username-availability?username=${encodeURIComponent(debouncedUsername)}`, getToken, { signal }),
  });

  const createProfile = useMutation({
    mutationFn: (body: CreateProfileRequest) => apiRequest<SelfResponse>('/users/me', getToken, { method: 'POST', body }),
    onSuccess: (response) => {
      if (!mounted.current) return;
      client.setQueryData(selfProfileKey, response);
      useOnboardingDraft.getState().clear();
      router.replace('/');
    },
  });

  if (profile.isPending || !userLoaded) return <LoadingScreen />;
  if (profile.isError) return <ProfileErrorScreen error={profile.error} onRetry={() => { void profile.refetch(); }} />;
  if (profile.data.user) return <Redirect href="/" />;

  const currentAvailability = availability.data?.username === canonicalUsername ? availability.data : undefined;
  const taken = currentAvailability?.available === false;
  const checking = validUsername && (debouncedUsername !== canonicalUsername || availability.isFetching);

  function submit() {
    if (!validUsername || !minimumAgeConfirmed || createProfile.isPending) return;
    createProfile.mutate({ username: canonicalUsername, minimumAgeConfirmed });
  }

  return <AuthPage title="What shall we call you?" subtitle="Choose a name for your corner of Lantern Post.">
    <View>
      <Text style={styles.label}>Username</Text>
      <TextInput accessibilityLabel="Username" style={styles.input} value={username} onChangeText={(value) => { setUsername(value); createProfile.reset(); }}
        autoCapitalize="none" autoCorrect={false} autoComplete="username-new" textContentType="username" maxLength={24}
        editable={!createProfile.isPending} onSubmitEditing={submit} />
    </View>
    <Text style={styles.hint}>Use 3–24 letters, numbers, or underscores. Your name will be lowercase.</Text>
    {username && !validUsername ? <FormError message="Use only letters, numbers, and underscores, with at least 3 characters." /> : null}
    {checking ? <Text accessibilityLiveRegion="polite" style={styles.hint}>Checking your name…</Text> : null}
    {!checking && currentAvailability?.available ? <Text accessibilityLiveRegion="polite" style={styles.available}>That name is available.</Text> : null}
    {!checking && taken ? <FormError message="Someone has already chosen that name. Try another." /> : null}
    {availability.isError ? <Text style={styles.hint}>We could not check availability. You can try continuing.</Text> : null}
    {!confirmedBeforeSignup ? <AgeConfirmation checked={ageChecked} onChange={setAgeChecked} disabled={createProfile.isPending} /> : null}
    <FormError message={createProfile.isError ? requestErrorMessage(createProfile.error) : null} />
    <ActionButton label={createProfile.isPending ? 'Saving your name…' : 'Meet my companion'} onPress={submit}
      disabled={!validUsername || !minimumAgeConfirmed || taken || createProfile.isPending} />
    {createProfile.isError ? <ActionButton label="Refresh account" onPress={() => { void profile.refetch(); }} secondary /> : null}
    <SignOutButton />
  </AuthPage>;
}
