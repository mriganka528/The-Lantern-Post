import { usePalaceConnection } from '../realtime/palace-live-state';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FriendsView } from '@lantern-post/shared-types';
import type { FriendsTransport } from './friends-api';

export const friendsKey = (ownerId: string) => ['friends', ownerId] as const;
export function useUnfriend(api: FriendsTransport, ownerId: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: (id: string) => { if (!api.unfriend) throw Error('Unfriend is unavailable'); return api.unfriend(id); },
    onSettled: () => cache.invalidateQueries({ queryKey: friendsKey(ownerId) }) });
}
export function useFriendsSummary(api: FriendsTransport, ownerId: string, enabled = true) {
  const live=usePalaceConnection(ownerId);
  return useQuery({ queryKey: [...friendsKey(ownerId), 'summary'], queryFn: ({ signal }) => api.summary(signal), enabled, staleTime: 10_000, refetchInterval: enabled && !live ? 30_000 : false });
}
export function useFriendsList(api: FriendsTransport, ownerId: string, view: FriendsView, enabled = true) {
  const live=usePalaceConnection(ownerId);
  return useInfiniteQuery({ queryKey: [...friendsKey(ownerId), 'list', view], initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => api.list(view, pageParam, signal), getNextPageParam: page => page.nextCursor,
    enabled, staleTime: 10_000, refetchInterval: enabled && !live ? 30_000 : false });
}
export function useFriendSearch(api: FriendsTransport, ownerId: string, username: string) {
  return useQuery({ queryKey: [...friendsKey(ownerId), 'search', username], queryFn: ({ signal }) => api.search(username, signal), enabled: Boolean(username), staleTime: 0 });
}
export function useFriendAction(api: FriendsTransport, ownerId: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: (action: { kind: 'send'; username: string } | { kind: 'accept' | 'decline'; id: string }) => action.kind === 'send' ? api.send(action.username) : api.respond(action.id, action.kind),
    onSettled: () => cache.invalidateQueries({ queryKey: friendsKey(ownerId) }) });
}
