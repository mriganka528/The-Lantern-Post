interface ClientEnvironmentInput {
  apiUrl: string | undefined;
  clerkPublishableKey: string | undefined;
  development: boolean;
  apiVariable: 'EXPO_PUBLIC_API_URL' | 'EXPO_PUBLIC_WEB_API_URL';
}

export function clientEnvironment({ apiUrl, clerkPublishableKey, development, apiVariable }: ClientEnvironmentInput) {
  if (!apiUrl) throw new Error(`Set ${apiVariable} in client/.env, then restart Expo.`);
  const parsedApiUrl = new URL(apiUrl);
  if (!['http:', 'https:'].includes(parsedApiUrl.protocol) || parsedApiUrl.username || parsedApiUrl.password || parsedApiUrl.search || parsedApiUrl.hash) {
    throw new Error(`${apiVariable} must be an HTTP(S) URL without credentials, query parameters, or fragments.`);
  }
  if (!clerkPublishableKey || !/^pk_(test|live)_[A-Za-z0-9_=-]+$/.test(clerkPublishableKey)) {
    throw new Error('Set a Clerk publishable key in EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in client/.env, then restart Expo.');
  }
  if (!development && parsedApiUrl.protocol !== 'https:') throw new Error('Release builds require an HTTPS API URL.');
  return { apiUrl: apiUrl.replace(/\/+$/, ''), clerkPublishableKey } as const;
}
