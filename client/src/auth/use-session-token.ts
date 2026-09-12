import { useAuth, useClerk } from '@clerk/expo';
import { useMemo } from 'react';
import { bindSessionToken } from './session-token';

export function useSessionToken() {
  const clerk = useClerk();
  const { getToken, sessionId } = useAuth();
  return useMemo(() => bindSessionToken(() => clerk.session?.id, sessionId, getToken), [clerk, getToken, sessionId]);
}
