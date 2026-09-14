import { usePalaceConnection } from '../realtime/palace-live-state';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { LetterBox } from '@lantern-post/shared-types';
import type { LetterBoxTransport } from './friend-letter-api';
export const letterboxKey = (ownerId: string) => ['letterbox', ownerId] as const;
export function useLetterboxSummary(api: LetterBoxTransport, ownerId: string, enabled = true) {
  const live=usePalaceConnection(ownerId);
  return useQuery({ queryKey: [...letterboxKey(ownerId), 'summary'], queryFn: ({ signal }) => api.summary(signal), enabled, staleTime: 10_000, refetchInterval: enabled && !live ? 30_000 : false });
}
export function useLetterbox(api: LetterBoxTransport, ownerId: string, box: LetterBox) {
  const live=usePalaceConnection(ownerId);
  return useInfiniteQuery({ queryKey: [...letterboxKey(ownerId), box], initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api.list(box, pageParam, signal), getNextPageParam: page => page.nextCursor, staleTime: 10_000, refetchInterval: live ? false : 30_000 });
}
