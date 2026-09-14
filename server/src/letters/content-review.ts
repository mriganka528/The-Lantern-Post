export type ContentDecision = 'APPROVED' | 'REJECTED' | 'NOT_REQUIRED';

// Keep unreviewed deliveries distinct from a provider's approval. This is
// server-owned metadata, never a value accepted from a send request.
export function reviewMetadata(decision: ContentDecision) {
  return decision === 'NOT_REQUIRED'
    ? { moderationPassed: null, moderationSkipped: true }
    : { moderationPassed: decision === 'APPROVED', moderationSkipped: false };
}
export function combinedReview(first: ContentDecision, second: ContentDecision): ContentDecision {
  if (first === 'REJECTED' || second === 'REJECTED') return 'REJECTED';
  return first === 'APPROVED' && second === 'APPROVED' ? 'APPROVED' : 'NOT_REQUIRED';
}
// Status, ownership, friendship, blocks and erased-content checks are added by
// each caller. A missing/failed required review never becomes visible here.
export const releasedContent = { OR: [{ moderationPassed: true }, { moderationSkipped: true, moderationPassed: null }] };
