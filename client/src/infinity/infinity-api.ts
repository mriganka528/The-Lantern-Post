import type { WorldBounds, WorldCapabilities, WorldLetter, WorldPage, WorldReceipt, WorldReceiptResponse, VoiceUploadGrant } from '@lantern-post/shared-types';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import { voiceStorage } from '../voice/voice-storage';
import { prepareVoiceUpload } from '../voice/voice-upload';
import type { WorldDeliveryTransport } from './world-controller';
export interface InfinityTransport { list(bounds: WorldBounds, cursor?: string | null, signal?: AbortSignal): Promise<WorldPage>; mine(cursor?: string | null, signal?: AbortSignal): Promise<WorldPage>; open(id: string, signal?: AbortSignal): Promise<WorldLetter>; remove(id: string): Promise<{ deleted: true }>; block(id: string): Promise<{ blocked: true }>; }
export function createInfinityTransport(token: GetSessionToken): InfinityTransport {
  return { list: (box, cursor, signal) => apiRequest(`/infinity/stars?minX=${box.minX}&minY=${box.minY}&maxX=${box.maxX}&maxY=${box.maxY}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, token, { signal }),
    mine: (cursor, signal) => apiRequest(`/infinity/mine${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, token, { signal }),
    open: (id, signal) => apiRequest(`/infinity/stars/${encodeURIComponent(id)}/open`, token, { method: 'POST', signal }),
    remove: id => apiRequest(`/infinity/stars/${encodeURIComponent(id)}/delete`, token, { method: 'POST', body: { confirmed: true } }),
    block: id => apiRequest(`/infinity/stars/${encodeURIComponent(id)}/block`, token, { method: 'POST', body: { confirmed: true } }),
  };
}
export function createWorldDeliveryTransport(token: GetSessionToken, ownerId: string): WorldDeliveryTransport {
  return { capabilities: signal => apiRequest<WorldCapabilities>('/infinity/capabilities', token, { signal }), lookup: id => apiRequest<WorldReceiptResponse>(`/infinity/requests/${encodeURIComponent(id)}`, token),
    cancel: (id, isSigned) => apiRequest(`/infinity/requests/${encodeURIComponent(id)}/cancel`, token, { method: 'POST', body: { isSigned } }),
    submit: async input => {
      if (input.type === 'TEXT') return apiRequest('/letters', token, { method: 'POST', body: input });
      const existing = await apiRequest<WorldReceiptResponse>(`/infinity/requests/${encodeURIComponent(input.requestId)}`, token); if (existing.receipt) return existing.receipt;
      const { bytes, sha256 } = await prepareVoiceUpload(voiceStorage, ownerId, input.voice);
      const grant = await apiRequest<VoiceUploadGrant>('/voice/uploads', token, { method: 'POST', body: { requestId: input.requestId, destinationType: 'INFINITY', mimeType: input.voice.mimeType, byteLength: input.voice.byteLength, durationMs: input.voice.durationMs, sha256 } });
      if (!/^voice_[a-f0-9]{64}$/.test(grant.assetId)) throw new Error('Invalid recording grant');
      let ready=false;
      if(grant.uploadViaApi){if(grant.uploadUrl!==null)throw new Error('Invalid recording grant');ready=(await apiRequest<{ready?:boolean}>(`/voice/uploads/${grant.assetId}/content`,token,{method:'POST',binary:{bytes,mimeType:input.voice.mimeType}})).ready===true;}
      else if (grant.uploadUrl) {
        const url = new URL(grant.uploadUrl); if ((url.protocol !== 'https:' && !(__DEV__ && url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || url.username || url.password || url.hash) throw new Error('Invalid recording address');
        const abort = new AbortController(); const timeout = setTimeout(() => abort.abort(), 60000);
        try { const response = await fetch(url.toString(), { method: 'PUT', headers: { 'Content-Type': input.voice.mimeType }, body: bytes.slice().buffer, redirect: 'error', signal: abort.signal }); if (!response.ok) throw new Error('Incomplete upload'); } finally { clearTimeout(timeout); }
      }
      if(!ready)await apiRequest(`/voice/uploads/${grant.assetId}/finish`, token, { method: 'POST' });
      return apiRequest<WorldReceipt>('/letters', token, { method: 'POST', body: { requestId: input.requestId, type: 'VOICE', destinationType: 'INFINITY', presetId: input.presetId, isSigned: input.isSigned, publicConfirmed: true, voiceAssetId: grant.assetId, voiceCaption: input.voiceCaption } });
    },
  };
}
