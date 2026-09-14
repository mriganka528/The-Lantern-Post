import type { VoiceClip, WorldReceipt, WorldRejection, WorldTextRequest } from '@lantern-post/shared-types';
export type PendingWorldLetter = WorldTextRequest | (Omit<WorldTextRequest, 'type' | 'textContent'> & { type: 'VOICE'; voice: VoiceClip; voiceCaption?: string });
const rejections: WorldRejection[] = ['PRESET_UNAVAILABLE', 'CONTENT_NOT_ALLOWED', 'DELIVERY_LIMIT', 'VOICE_UNAVAILABLE', 'CANCELLED'];
export function readWorldReceipt(value: unknown, requestId: string, isSigned: boolean): WorldReceipt | null {
  if (!value || typeof value !== 'object') return null; const r = value as Record<string, unknown>;
  if (typeof r.requestId !== 'string' || r.requestId.toLowerCase() !== requestId.toLowerCase() || typeof r.receiptId !== 'string' || !/^world_[a-f0-9]{64}$/.test(r.receiptId) || r.isSigned !== isSigned || typeof r.completedAt !== 'string' || !Number.isFinite(Date.parse(r.completedAt)) ||
    !((r.outcome === 'DELIVERED' && r.reason === null && typeof r.letterId === 'string' && /^star_[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(r.letterId)) || (r.outcome === 'REJECTED' && r.letterId === null && rejections.includes(r.reason as WorldRejection)))) return null;
  return { requestId: r.requestId.toLowerCase(), receiptId: r.receiptId, outcome: r.outcome, reason: r.reason, isSigned, letterId: r.letterId, completedAt: r.completedAt } as WorldReceipt;
}
export function worldRejectionMessage(reason: WorldRejection | null) {
  if (reason === 'CONTENT_NOT_ALLOWED') return 'This letter could not join the shared sky. It is kept here for you to revise or record again.';
  if (reason === 'PRESET_UNAVAILABLE') return 'That stationery is unavailable. Your letter is kept here; choose another style.';
  if (reason === 'VOICE_UNAVAILABLE') return 'That recording could not be shared. It remains on this device for you to check or record again.';
  if (reason === 'DELIVERY_LIMIT') return 'You have shared enough lights for today. Your letter is kept here for another day.';
  return 'Sharing was cancelled. Your sealed letter is still here with you.';
}
