import type { BurnReceipt } from '@lantern-post/shared-types';

export const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function readBurnReceipt(value: unknown, requestId: string): BurnReceipt | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  if (typeof row.requestId !== 'string' || row.requestId.toLowerCase() !== requestId.toLowerCase() ||
    typeof row.receiptId !== 'string' || !/^burn_[a-f0-9]{64}$/.test(row.receiptId) ||
    typeof row.completedAt !== 'string' || !Number.isFinite(Date.parse(row.completedAt)) ||
    !((row.outcome === 'BURNED' && row.reason === null) || (row.outcome === 'REJECTED' && row.reason === 'PRESET_UNAVAILABLE'))) return null;
  return { requestId: row.requestId.toLowerCase(), receiptId: row.receiptId, outcome: row.outcome, reason: row.reason, completedAt: row.completedAt } as BurnReceipt;
}
