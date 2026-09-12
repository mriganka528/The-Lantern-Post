import { useAuth } from '@clerk/expo';
import { useQuery } from '@tanstack/react-query';
import type { SelfResponse } from '@lantern-post/shared-types';
import { apiRequest } from './client';
import { useSessionToken } from '../auth/use-session-token';

export const selfProfileKey = ['self-profile'] as const;

export function useSelfProfile() {
  const { isLoaded, isSignedIn } = useAuth();
  const getToken = useSessionToken();
  return useQuery({
    queryKey: selfProfileKey,
    enabled: isLoaded && Boolean(isSignedIn),
    queryFn: ({ signal }) => apiRequest<SelfResponse>('/users/me', getToken, { signal }),
  });
}
