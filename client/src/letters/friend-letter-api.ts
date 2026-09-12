import type { LetterBox, LetterBoxPage, LetterBoxSummary, OpenedFriendLetter } from '@lantern-post/shared-types';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import type { DeliveryTransport } from './delivery-controller';
export function createDeliveryTransport(getToken: GetSessionToken): DeliveryTransport {
  return {
    submit: input => apiRequest('/letters', getToken, { method: 'POST', body: input }),
    lookup: requestId => apiRequest(`/letters/friends/requests/${encodeURIComponent(requestId)}`, getToken),
    cancel: (requestId, recipientId) => apiRequest(`/letters/friends/requests/${encodeURIComponent(requestId)}/cancel`, getToken, { method: 'POST', body: { recipientId } }),
    capabilities: signal => apiRequest('/letters/friends/capabilities', getToken, { signal }),
  };
}
export interface LetterBoxTransport {
  list(box: LetterBox, cursor?: string | null, signal?: AbortSignal): Promise<LetterBoxPage>;
  summary(signal?: AbortSignal): Promise<LetterBoxSummary>;
  open(id: string, signal?: AbortSignal): Promise<OpenedFriendLetter>;
  remove(id: string): Promise<{ deleted: true }>;
}
export function createLetterBoxTransport(getToken: GetSessionToken): LetterBoxTransport {
  return {
    list: (box, cursor, signal) => apiRequest(`/letters/friends?box=${box}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, getToken, { signal }),
    summary: signal => apiRequest('/letters/friends/summary', getToken, { signal }),
    open: (id, signal) => apiRequest(`/letters/friends/${encodeURIComponent(id)}/open`, getToken, { method: 'POST', signal }),
    remove: id => apiRequest(`/letters/friends/${encodeURIComponent(id)}/delete`, getToken, { method: 'POST' }),
  };
}
