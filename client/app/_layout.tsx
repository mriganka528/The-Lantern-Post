import { ClerkProvider, useAuth } from '@clerk/expo';
import { tokenCache } from '../src/auth/token-cache';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SessionDataProvider } from '../src/api/session-data-provider';
import { LoadingScreen } from '../src/components/auth-ui';
import { ClerkCaptcha } from '../src/components/clerk-captcha';
import { env } from '../src/config/env';
import { NotificationSession } from '../src/notifications/use-notification-session';

export default function RootLayout() {
  return (
    // Our screens use Clerk's JS flows and SecureStore, with no Clerk native UI.
    // Disable the optional native client sync so this also works in Expo Go.
    <ClerkProvider publishableKey={env.clerkPublishableKey} tokenCache={tokenCache} __experimental_disableNativeClientSync>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: '#FAF4E8' }}>
        <SessionRoutes />
        <ClerkCaptcha />
      </View>
    </ClerkProvider>
  );
}

function SessionRoutes() {
  const { isLoaded, isSignedIn, userId, sessionId } = useAuth();
  const pathname = usePathname();
  if (!isLoaded) return <LoadingScreen />;
  // Completing OAuth activates the session. Keep its callback mounted through
  // that activation, then create the private cache for the completed session.
  const cacheKey = pathname === '/oauth-callback' ? 'oauth-callback' : isSignedIn ? `${userId}:${sessionId}` : 'signed-out';
  return (
    <SessionDataProvider key={cacheKey}>
      {isSignedIn && pathname !== '/oauth-callback' && <NotificationSession />}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FAF4E8' } }}>
        <Stack.Screen name="oauth-callback" />
        <Stack.Screen name="oauth-complete" />
        <Stack.Protected guard={!isSignedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(isSignedIn)}>
          <Stack.Screen name="index" />
          <Stack.Screen name="choose-username" />
          <Stack.Screen name="choose-character" />
          <Stack.Screen name="writing-desk" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="inbox" />
        </Stack.Protected>
      </Stack>
    </SessionDataProvider>
  );
}
