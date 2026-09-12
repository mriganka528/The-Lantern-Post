// Use the same SignIn resource as the email flow and the native useSSO hook.
import { useSignIn } from '@clerk/expo/legacy';
import { googleRedirects, requireGoogleAgeConfirmation } from './google-flow';
import { clearGoogleAge, saveGoogleAge } from './google-age-storage';

export function useGoogleSignIn() {
  const { isLoaded, signIn } = useSignIn();
  return async (ageConfirmed: boolean): Promise<void> => {
    requireGoogleAgeConfirmation(ageConfirmed);
    if (!isLoaded) throw new Error('Sign-in is still loading.');
    try { saveGoogleAge(window.sessionStorage); } catch { /* Onboarding can ask again if storage is blocked. */ }
    try { await signIn.authenticateWithRedirect(googleRedirects(window.location.origin)); }
    catch (error) {
      try { clearGoogleAge(window.sessionStorage); } catch { /* No stored consent to clear. */ }
      throw error;
    }
  };
}
