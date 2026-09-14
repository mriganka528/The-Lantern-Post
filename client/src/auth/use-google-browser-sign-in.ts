import { useSSO } from '@clerk/expo';
import { makeRedirectUri } from 'expo-auth-session';
import { activateGoogleSession, requireGoogleAgeConfirmation } from './google-flow';
import { useOnboardingDraft } from './onboarding-store';

export function useGoogleBrowserSignIn() {
  const { startSSOFlow } = useSSO();
  return async (ageConfirmed: boolean): Promise<void> => {
    requireGoogleAgeConfirmation(ageConfirmed);
    const result = await startSSOFlow({ strategy: 'oauth_google', redirectUrl: makeRedirectUri({ scheme: 'lantern-post', path: 'oauth-callback' }) });
    const draft = useOnboardingDraft.getState();
    await activateGoogleSession(result, draft.confirmMinimumAgeForSession, draft.clearSessionConfirmation);
  };
}
