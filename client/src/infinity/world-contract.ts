import type { VoiceClip, WorldReceipt, WorldRejection, WorldTextRequest } from '@lantern-post/shared-types';
import { voicePreparationProblem } from '../voice/voice-upload';
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
export function worldDeliveryProblem(error: unknown): string {
  const preparation = voicePreparationProblem(error); if (preparation) return preparation;
  const value = error && typeof error === 'object' ? error as { code?: unknown; status?: unknown; name?: unknown } : {};
  if (value.code === 'VOICE_STORAGE_FULL') return 'The recording cabinet is full for now. Your recording stays here; you can cancel sharing and try later.';
  if (value.code === 'VOICE_UPLOAD_EXPIRED') return 'This recording upload expired. Check its status, or cancel sharing and send the saved recording again.';
  if (value.code === 'VOICE_INVALID' || value.code === 'VOICE_UPLOAD_MISMATCH') return 'The recording could not be validated. Check its status, or cancel sharing to keep your letter and record a new take.';
  if (value.code === 'VOICE_UPLOAD_LIMIT') return 'Finish or cancel another pending voice delivery, then retry this letter.';
  if (value.code === 'VOICE_STORAGE_UNAVAILABLE') return 'Voice delivery is temporarily unavailable. Your recording is kept; check its status before retrying.';
  if (value.code === 'MODERATION_UNAVAILABLE') return 'Public sharing is resting. This letter has not been confirmed; you can cancel and keep it.';
  if (value.status === 401) return 'Sign in again to finish sharing. Your pending letter and recording stay on this device.';
  if (value.status === 429) return 'The palace post needs a short rest. Wait a minute, then check this letter’s status.';
  if (value.name === 'ApiTimeoutError') return 'The upload or reply took too long. Your recording is kept. Check its status before retrying.';
  return 'We could not confirm sharing. Your letter stays sealed. Check its status or retry in a little while.';
}
