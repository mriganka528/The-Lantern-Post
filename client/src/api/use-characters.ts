import { useQuery } from '@tanstack/react-query';
import type { CharactersResponse, PalaceResponse } from '@lantern-post/shared-types';
import { useSessionToken } from '../auth/use-session-token';
import { apiRequest } from './client';

export const charactersKey = ['characters'] as const;
export const palaceKey = ['palace'] as const;

export function useCharacters(enabled: boolean) {
  const getToken = useSessionToken();
  return useQuery({
    queryKey: charactersKey, enabled,
    queryFn: ({ signal }) => apiRequest<CharactersResponse>('/characters', getToken, { signal }),
  });
}

export function usePalace(characterId: string | null) {
  const getToken = useSessionToken();
  return useQuery({
    queryKey: [...palaceKey, characterId], enabled: Boolean(characterId),
    queryFn: ({ signal }) => apiRequest<PalaceResponse>('/users/me/palace', getToken, { signal }),
  });
}
