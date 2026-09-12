import type { GetSessionToken } from '../api/client';

export function bindSessionToken(
  readCurrentSession: () => string | null | undefined,
  expectedSession: string | null | undefined,
  getToken: GetSessionToken,
): GetSessionToken {
  return async (options) => {
    if (!expectedSession || readCurrentSession() !== expectedSession) return null;
    const token = await getToken(options);
    // A delayed token refresh from an old screen must never retry that screen's
    // request using a newly signed-in account's credentials.
    return readCurrentSession() === expectedSession ? token : null;
  };
}
