import { useClerk } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { GOOGLE_COMPLETE_PATH } from '../src/auth/google-flow';
import { clearGoogleAge } from '../src/auth/google-age-storage';
import { clerkErrorMessage } from '../src/auth/clerk-errors';
import { ActionButton, AuthPage, LoadingScreen } from '../src/components/auth-ui';

export default function OAuthCallbackScreen() {
  const clerk = useClerk();
  const router = useRouter();
  const pending = useRef<Promise<unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    // Share the same SDK completion promise through React's effect replay.
    pending.current ??= clerk.handleRedirectCallback({
      signInUrl: '/sign-in', signUpUrl: '/sign-in',
      signInForceRedirectUrl: GOOGLE_COMPLETE_PATH, signUpForceRedirectUrl: GOOGLE_COMPLETE_PATH,
      firstFactorUrl: '/sign-in', secondFactorUrl: '/sign-in', continueSignUpUrl: '/sign-in',
    });
    void pending.current.catch((cause: unknown) => {
      if (!mounted) return;
      try { clearGoogleAge(window.sessionStorage); } catch { /* Storage may be disabled. */ }
      setError(clerkErrorMessage(cause));
    });
    return () => { mounted = false; };
  }, [clerk]);
  if (error) return <AuthPage title="Could not finish sign-in" subtitle={error}>
    <ActionButton label="Back to sign-in" onPress={() => router.replace('/sign-in')} />
  </AuthPage>;
  return <LoadingScreen />;
}
