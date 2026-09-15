import type { FriendConnection, FriendSearchResponse, FriendSummary, FriendsPage, FriendsView } from '@lantern-post/shared-types';
import { apiRequest, ApiError, requestErrorMessage } from '../api/client';
import type { GetSessionToken } from '../api/client';

export interface FriendsTransport {
  search(username: string, signal?: AbortSignal): Promise<FriendSearchResponse>;
  list(view: FriendsView, cursor?: string | null, signal?: AbortSignal): Promise<FriendsPage>;
  summary(signal?: AbortSignal): Promise<FriendSummary>;
  send(username: string): Promise<FriendConnection>;
  respond(id: string, action: 'accept' | 'decline'): Promise<FriendConnection>;
  unfriend?(id: string): Promise<{ removed: true }>;
}
export const normalizeFriendSearch = (value: string) => value.trim().replace(/^@/, '').toLowerCase();
export const validFriendSearch = (value: string) => /^[a-z0-9_]{3,24}$/.test(normalizeFriendSearch(value));
export function createFriendsTransport(getToken: GetSessionToken): FriendsTransport {
  return {
    search: (username, signal) => apiRequest(`/friends/search?username=${encodeURIComponent(normalizeFriendSearch(username))}`, getToken, { signal }),
    list: (view, cursor, signal) => apiRequest(`/friends?view=${view}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, getToken, { signal }),
    summary: signal => apiRequest('/friends/summary', getToken, { signal }),
    send: username => apiRequest('/friends/requests', getToken, { method: 'POST', body: { username: normalizeFriendSearch(username) } }),
    respond: (id, action) => apiRequest(`/friends/requests/${encodeURIComponent(id)}/respond`, getToken, { method: 'POST', body: { action } }),
    unfriend: id => apiRequest(`/friends/${encodeURIComponent(id)}/remove`, getToken, { method: 'POST', body: { confirmed: true } }),
  };
}
export function friendErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'INVITATION_LIMIT') return 'You have sent your invitations for today. Let the post rest, and try again tomorrow.';
    if (error.code === 'INVITATION_UNAVAILABLE') return 'This palace is not receiving another invitation just yet. Try again another day.';
    if (error.code === 'FRIEND_UNAVAILABLE') return 'We could not find a palace that can receive this invitation. Check the username.';
    if (['INVITATION_MISSING', 'INVITATION_RESOLVED'].includes(error.code ?? '')) return 'This invitation has changed. Refresh your guestbook to see its latest reply.';
  }
  return requestErrorMessage(error);
}
