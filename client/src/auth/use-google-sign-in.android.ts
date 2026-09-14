import { useSignInWithGoogle } from '@clerk/expo/google';
import { useClerk } from '@clerk/expo';
import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useEffect, useRef } from 'react';
import { activateNativeGoogleSession, requireGoogleAgeConfirmation } from './google-flow';
import { NativeGoogleError, withNativeGooglePicker } from './native-google-state';
import { googleForeground } from './native-google-foreground';
import { useGoogleBrowserSignIn } from './use-google-browser-sign-in';
import { useOnboardingDraft } from './onboarding-store';

export function useGoogleSignIn() {
  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();
  const clerk = useClerk();
  const browserSignIn = useGoogleBrowserSignIn();
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; operation.current?.abort(); }; }, []);
  return async (ageConfirmed: boolean): Promise<void> => {
    requireGoogleAgeConfirmation(ageConfirmed);
    // Existing development APKs and Expo Go cannot acquire a new native module
    // through Metro. Their established browser flow remains available.
    if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient || !requireOptionalNativeModule('ClerkGoogleSignIn')) {
      await browserSignIn(ageConfirmed); return;
    }
    if (operation.current) return;
    const clientId = Constants.expoConfig?.extra?.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID;
    if (!clientId) { await browserSignIn(ageConfirmed); return; }
    if (typeof clientId !== 'string' || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId)) throw new NativeGoogleError('setup');
    const abort = new AbortController(); operation.current = abort;
    try {
      const previous = { signInId: clerk.client?.signIn.id, signUpId: clerk.client?.signUp.id };
      const result = await withNativeGooglePicker(abort.signal, async () => {
        const value = await startGoogleAuthenticationFlow();
        if (!await googleForeground(abort.signal)) throw new NativeGoogleError('interrupted');
        return value;
      });
      if (!mounted.current || abort.signal.aborted) return;
      const draft = useOnboardingDraft.getState();
      await activateNativeGoogleSession(result, draft.confirmMinimumAgeForSession, draft.clearSessionConfirmation, previous);
    } finally { if (operation.current === abort) operation.current = null; }
  };
}
