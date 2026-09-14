import type { BlockedPalacesPage, LetterReportReceipt, LetterReportRequest } from '@lantern-post/shared-types';
import { apiRequest, ApiError, requestErrorMessage } from '../api/client';
import type { GetSessionToken } from '../api/client';
export interface SafetyTransport {
  blocked(cursor?: string | null, signal?: AbortSignal): Promise<BlockedPalacesPage>;
  block(id: string): Promise<{ blocked: true }>;
  unblock(id: string): Promise<{ unblocked: true }>;
  report(id: string, input: LetterReportRequest): Promise<LetterReportReceipt>;
}
export function createSafetyTransport(token: GetSessionToken): SafetyTransport {
  return { blocked: (cursor, signal) => apiRequest(`/safety/blocks${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, token, { signal }),
    block: id => apiRequest(`/safety/blocks/${encodeURIComponent(id)}`, token, { method: 'POST', body: { confirmed: true } }),
    unblock: id => apiRequest(`/safety/blocks/${encodeURIComponent(id)}/unblock`, token, { method: 'POST', body: { confirmed: true } }),
    report: (id, input) => apiRequest(`/safety/letters/${encodeURIComponent(id)}/report`, token, { method: 'POST', body: input }),
  };
}
export function safetyError(error: unknown) {
  if (error instanceof ApiError && error.status === 404) return 'This palace or received letter is no longer available. Refresh and try again.';
  return requestErrorMessage(error);
}
