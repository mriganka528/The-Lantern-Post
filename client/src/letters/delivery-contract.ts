import type { DeliveryReceipt, DeliveryRejection, LetterRecipient } from '@lantern-post/shared-types';
import { CHARACTER_KEYS } from '../storybook/character-keys';
const rejections: DeliveryRejection[] = ['FRIEND_UNAVAILABLE', 'PRESET_UNAVAILABLE', 'CONTENT_NOT_ALLOWED', 'DELIVERY_LIMIT', 'VOICE_UNAVAILABLE', 'CANCELLED'];
const characterKeys: readonly string[] = CHARACTER_KEYS;
export function cleanRecipient(value: unknown): LetterRecipient | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(r.id) || typeof r.username !== 'string' || !/^[a-z0-9_]{3,24}$/.test(r.username) ||
    (r.characterKey !== null && (typeof r.characterKey !== 'string' || !characterKeys.includes(r.characterKey))) || typeof r.palaceName !== 'string' || r.palaceName.length > 200) return null;
  return { id: r.id, username: r.username, characterKey: r.characterKey as LetterRecipient['characterKey'], palaceName: r.palaceName };
}
export function readDeliveryReceipt(value: unknown, requestId: string, recipientId: string): DeliveryReceipt | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  if (typeof r.requestId !== 'string' || r.requestId.toLowerCase() !== requestId.toLowerCase() || r.recipientId !== recipientId ||
    typeof r.receiptId !== 'string' || !/^delivery_[a-f0-9]{64}$/.test(r.receiptId) || typeof r.completedAt !== 'string' || !Number.isFinite(Date.parse(r.completedAt)) ||
    !((r.outcome === 'DELIVERED' && r.reason === null && r.letterId === r.receiptId) || (r.outcome === 'REJECTED' && r.letterId === null && rejections.includes(r.reason as DeliveryRejection)))) return null;
  return { requestId: r.requestId.toLowerCase(), recipientId, receiptId: r.receiptId, completedAt: r.completedAt, outcome: r.outcome, reason: r.reason, letterId: r.letterId } as DeliveryReceipt;
}
export function deliveryRejectionMessage(reason: DeliveryRejection | null): string {
  if (reason === 'FRIEND_UNAVAILABLE') return 'That friendship gate is unavailable. Your letter is kept here; refresh your friends before choosing a gate.';
  if (reason === 'PRESET_UNAVAILABLE') return 'That stationery is unavailable. Your letter is kept here; choose another style.';
  if (reason === 'CONTENT_NOT_ALLOWED') return 'This letter could not be delivered. It is kept here for you to revise or record again.';
  if (reason === 'DELIVERY_LIMIT') return 'The palace post has carried enough letters for today. Your letter is kept here for another day.';
  if (reason === 'VOICE_UNAVAILABLE') return 'That recording could not be delivered. It is kept on this device; reopen the envelope to check it or record again.';
  return 'The delivery was cancelled. Your sealed letter is still here with you.';
}
