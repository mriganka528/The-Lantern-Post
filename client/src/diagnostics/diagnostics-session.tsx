import type { PropsWithChildren } from 'react';
import { useSelfProfile } from '../api/use-self-profile';
import { useSessionToken } from '../auth/use-session-token';
import { DiagnosticsProvider } from './diagnostics-provider';
import { ApplicationBoundary } from './application-boundary';
export function DiagnosticsSession({ children }: PropsWithChildren) {
  const profile = useSelfProfile(); const token = useSessionToken(); const ownerId = profile.data?.user?.characterId ? profile.data.user.id : '';
  return <DiagnosticsProvider ownerId={ownerId} token={token}><ApplicationBoundary>{children}</ApplicationBoundary></DiagnosticsProvider>;
}
