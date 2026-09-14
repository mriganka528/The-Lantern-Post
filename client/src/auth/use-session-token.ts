import { useAuth, useClerk } from '@clerk/expo';
import { useMemo } from 'react';
import { tokenForSession } from './session-token';

export function useSessionToken() {
  const clerk = useClerk();
  const { sessionId } = useAuth();
  // Expo's useAuth wraps getToken in a new function on every render. Depending
  // on that function restarted live subscriptions whenever a query updated.
  return useMemo(() => tokenForSession(clerk, sessionId), [clerk, sessionId]);
}
