import { useClerk } from '@clerk/expo';
import { useState } from 'react';
import { requestErrorMessage } from '../api/client';
import { useOnboardingDraft } from '../auth/onboarding-store';
import { takePendingGoogleAge } from '../auth/pending-google-age';
import { ActionButton, AuthPage, FormError } from './auth-ui';
import { useSessionToken } from '../auth/use-session-token';
import { useSelfProfile } from '../api/use-self-profile';
import { disableDevicePush } from '../notifications/notification-settings';

export function SignOutButton() {
  const { signOut } = useClerk();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getToken = useSessionToken(); const profile = useSelfProfile();
  async function leave() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      useOnboardingDraft.getState().clear();
      takePendingGoogleAge();
      // Best effort: signing out must remain possible during an API outage.
      await disableDevicePush(profile.data?.user?.id ?? '', getToken).catch(() => {});
      await signOut();
    } catch {
      setError('We could not sign you out. Please try again.');
    } finally { setBusy(false); }
  }
  return <>
    <ActionButton label={busy ? 'Signing out…' : 'Sign out'} onPress={() => { void leave(); }} disabled={busy} secondary />
    <FormError message={error} />
  </>;
}

export function ProfileErrorScreen({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return <AuthPage title="Could not open your gate" subtitle={requestErrorMessage(error)}>
    <ActionButton label="Try again" onPress={onRetry} />
    <SignOutButton />
  </AuthPage>;
}
