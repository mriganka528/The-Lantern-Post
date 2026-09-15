import type { DeliveryReceiptResponse, LetterBox, LetterBoxPage, LetterBoxSummary, OpenedFriendLetter, VoiceUploadGrant } from '@lantern-post/shared-types';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import type { DeliveryTransport } from './delivery-controller';
import { voiceStorage } from '../voice/voice-storage';
import { prepareVoiceUpload } from '../voice/voice-upload';
export function createDeliveryTransport(getToken: GetSessionToken, ownerId = ''): DeliveryTransport {
  return {
    submit: async input => {
      if (input.type === 'TEXT') return apiRequest('/letters', getToken, { method: 'POST', body: input });
      const existing = await apiRequest<DeliveryReceiptResponse>(`/letters/friends/requests/${encodeURIComponent(input.requestId)}`, getToken);
      if (existing.receipt) return existing.receipt;
      if (!ownerId) throw new Error('A recording owner is required.');
      const { bytes, sha256 } = await prepareVoiceUpload(voiceStorage, ownerId, input.voice);
      const grant = await apiRequest<VoiceUploadGrant>('/voice/uploads', getToken, { method: 'POST', body: { requestId: input.requestId, recipientId: input.recipientId, mimeType: input.voice.mimeType, byteLength: input.voice.byteLength, durationMs: input.voice.durationMs, sha256 } });
      if (!/^voice_[a-f0-9]{64}$/.test(grant.assetId)) throw new Error('Invalid recording grant.');
      let ready=false;
      if(grant.uploadViaApi){if(grant.uploadUrl!==null)throw new Error('Invalid recording grant.');ready=(await apiRequest<{ready?:boolean}>(`/voice/uploads/${grant.assetId}/content`,getToken,{method:'POST',binary:{bytes,mimeType:input.voice.mimeType}})).ready===true;}
      else if (grant.uploadUrl) {
        const url = new URL(grant.uploadUrl);
        if ((url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.hash) throw new Error('Invalid recording upload address.');
        const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 60_000);
        try { const response = await fetch(url.toString(), { method: 'PUT', headers: { 'Content-Type': input.voice.mimeType }, body: bytes.slice().buffer, signal: abort.signal, redirect: 'error' }); if (!response.ok) throw new Error('The upload was not completed.'); }
        finally { clearTimeout(timeout); }
      }
      if(!ready)await apiRequest(`/voice/uploads/${grant.assetId}/finish`, getToken, { method: 'POST' });
      return apiRequest('/letters', getToken, { method: 'POST', body: { requestId: input.requestId, type: 'VOICE', destinationType: 'FRIEND', recipientId: input.recipientId, presetId: input.presetId, deliveryConfirmed: true, voiceAssetId: grant.assetId, voiceCaption: input.voiceCaption } });
    },
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
