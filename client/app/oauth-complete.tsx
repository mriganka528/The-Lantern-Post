import { useAuth } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { takePendingGoogleAge } from '../src/auth/pending-google-age';
import { useOnboardingDraft } from '../src/auth/onboarding-store';
import { LoadingScreen } from '../src/components/auth-ui';

export default function OAuthCompleteScreen() {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!isLoaded) return;
    if (takePendingGoogleAge() && isSignedIn && sessionId) {
      useOnboardingDraft.getState().confirmMinimumAgeForSession(sessionId);
    }
    router.replace(isSignedIn ? '/' : '/sign-in');
  }, [isLoaded, isSignedIn, sessionId, router]);
  return <LoadingScreen />;
}
