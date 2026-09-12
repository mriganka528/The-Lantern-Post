import { clientEnvironment } from './environment';

export const env = clientEnvironment({
  apiUrl: process.env.EXPO_PUBLIC_WEB_API_URL || (__DEV__ ? 'http://localhost:3000' : undefined),
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  development: __DEV__,
  apiVariable: 'EXPO_PUBLIC_WEB_API_URL',
});
