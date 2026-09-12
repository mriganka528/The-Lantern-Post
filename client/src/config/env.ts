import { clientEnvironment } from './environment';

export const env = clientEnvironment({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  clerkPublishableKey: process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY,
  development: __DEV__,
  apiVariable: 'EXPO_PUBLIC_API_URL',
});
