export const GOOGLE_CALLBACK_PATH = '/oauth-callback';
export const GOOGLE_COMPLETE_PATH = '/oauth-complete';

export class GoogleSignInError extends Error {}

export function requireGoogleAgeConfirmation(confirmed: boolean): void {
  if (!confirmed) throw new GoogleSignInError('Confirm that you are at least 13 years old before continuing with Google.');
}

export interface NativeGoogleResult {
  createdSessionId: string | null;
  authSessionResult?: { type: string } | null;
  setActive?: (parameters: { session: string }) => Promise<void>;
}

export async function activateGoogleSession(
  result: NativeGoogleResult,
  confirmAgeForSession: (sessionId: string) => void,
  clearAgeForSession: (sessionId: string) => void,
): Promise<boolean> {
  if (result.authSessionResult?.type === 'cancel' || result.authSessionResult?.type === 'dismiss') return false;
  if (!result.createdSessionId || !result.setActive) {
    throw new GoogleSignInError('Google sign-in needs another verification step. Please try email sign-in.');
  }
  const sessionId = result.createdSessionId;
  confirmAgeForSession(sessionId);
  try { await result.setActive({ session: sessionId }); }
  catch (error) { clearAgeForSession(sessionId); throw error; }
  return true;
}

export function googleRedirects(origin: string) {
  const url = new URL(origin);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid application origin.');
  return {
    strategy: 'oauth_google' as const,
    redirectUrl: new URL(GOOGLE_CALLBACK_PATH, url.origin).toString(),
    redirectUrlComplete: new URL(GOOGLE_COMPLETE_PATH, url.origin).toString(),
  };
}
