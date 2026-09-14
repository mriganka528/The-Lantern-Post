import { requestIdPattern } from './burn-contract';
import type { DraftStorage, LetterDraft } from './draft';

export interface RemovedLetter {
  type: 'removed-letter'; version: 1; ownerId: string; generationId: string; removedAt: string; voiceDeletes: string[];
}
export function readRemovedLetter(raw: string | null, ownerId: string): RemovedLetter | null {
  if (!raw || raw.length > 100_000) return null;
  let value: unknown; try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== 'object') return null;
  const d = value as Record<string, unknown>;
  if (d.type !== 'removed-letter' || d.version !== 1 || d.ownerId !== ownerId || typeof d.generationId !== 'string' || !d.generationId || d.generationId.length > 200 || typeof d.removedAt !== 'string' || !Number.isFinite(Date.parse(d.removedAt)) || !Array.isArray(d.voiceDeletes) || d.voiceDeletes.length > 9 || d.voiceDeletes.some(id => typeof id !== 'string' || !requestIdPattern.test(id)) || new Set(d.voiceDeletes).size !== d.voiceDeletes.length) return null;
  return { type: 'removed-letter', version: 1, ownerId, generationId: d.generationId, removedAt: d.removedAt, voiceDeletes: d.voiceDeletes as string[] };
}
export function removedLetter(draft: LetterDraft): RemovedLetter {
  return { type: 'removed-letter', version: 1, ownerId: draft.ownerId, generationId: draft.generationId, removedAt: new Date().toISOString(), voiceDeletes: [...new Set([...draft.voiceDeletes, ...(draft.voice ? [draft.voice.id] : [])])] };
}
export function finishRemovedVoiceDelete(storage: DraftStorage, key: string, ownerId: string, id: string): boolean {
  const current = readRemovedLetter(storage.read(key), ownerId);
  if (!current) return false;
  if (current.voiceDeletes.includes(id)) storage.write(key, JSON.stringify({ ...current, voiceDeletes: current.voiceDeletes.filter(value => value !== id) }));
  return true;
}
