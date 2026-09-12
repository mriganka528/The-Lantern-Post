import type { BurnReceipt, BurnReceiptResponse } from '@lantern-post/shared-types';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import type { BurnTransport } from './burn-controller';

export function createBurnTransport(getToken: GetSessionToken): BurnTransport {
  return {
    submit: body => apiRequest<BurnReceipt>('/letters', getToken, { method: 'POST', body }),
    lookup: requestId => apiRequest<BurnReceiptResponse>(`/letters/burning/requests/${encodeURIComponent(requestId)}`, getToken),
  };
}
