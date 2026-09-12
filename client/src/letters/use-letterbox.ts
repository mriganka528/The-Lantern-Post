import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { LetterBox } from '@lantern-post/shared-types';
import type { LetterBoxTransport } from './friend-letter-api';
export const letterboxKey = (ownerId: string) => ['letterbox', ownerId] as const;
export function useLetterboxSummary(api: LetterBoxTransport, ownerId: string, enabled = true) {
  return useQuery({ queryKey: [...letterboxKey(ownerId), 'summary'], queryFn: ({ signal }) => api.summary(signal), enabled, staleTime: 10_000, refetchInterval: enabled ? 30_000 : false });
}
export function useLetterbox(api: LetterBoxTransport, ownerId: string, box: LetterBox) {
  return useInfiniteQuery({ queryKey: [...letterboxKey(ownerId), box], initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api.list(box, pageParam, signal), getNextPageParam: page => page.nextCursor, staleTime: 10_000, refetchInterval: 30_000 });
}
