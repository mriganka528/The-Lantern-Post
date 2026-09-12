import { useAuth } from '@clerk/expo';
import { Redirect } from 'expo-router';
import { LoadingScreen } from '../src/components/auth-ui';

export default function OAuthCallbackScreen() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen />;
  return <Redirect href={isSignedIn ? '/' : '/sign-in'} />;
}
