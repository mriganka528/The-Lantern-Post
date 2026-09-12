import { useQuery } from '@tanstack/react-query';
import type { PresetsResponse } from '@lantern-post/shared-types';
import { apiRequest } from './client';
import { useSessionToken } from '../auth/use-session-token';

export function usePresets(enabled: boolean) {
  const getToken = useSessionToken();
  return useQuery({
    queryKey: ['letter-presets'], enabled, staleTime: 300_000,
    queryFn: ({ signal }) => apiRequest<PresetsResponse>('/presets', getToken, { signal }),
  });
}
