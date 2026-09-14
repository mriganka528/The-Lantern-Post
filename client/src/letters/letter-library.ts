import { decodeDraft, draftKey, newDraft, pendingStage, terminalStage } from './draft';
import type { DraftStorage, LetterDraft } from './draft';
import { requestIdPattern } from './burn-contract';
import { readRemovedLetter, removedLetter } from './removed-letter';

export interface LetterLibraryStorage extends DraftStorage { keys(): string[]; cleanupKeys?():string[]; remove?(key: string): void; watch?(listener: (key: string | null) => void): () => void; }
export interface LetterEntry { id: string; title: string; stage: LetterDraft['stage'] | 'unreadable'; updatedAt: string; cleanup: boolean; }
export const LEGACY_LETTER = 'original';
export const letterDocumentId = (id: string) => id === LEGACY_LETTER ? undefined : id;
export interface RemovalTicket { id: string; revision: string; kind: LetterDraft['kind']; }
export class LetterRemovalError extends Error {
  constructor(readonly code: 'changed' | 'protected' | 'unavailable') { super(code); }
}
export const letterStageLabel = (stage: LetterEntry['stage']) => ({ writing: 'On the writing desk', sealed: 'Sealed · still yours', 'burn-pending': 'Release awaiting receipt', burned: 'Released to the fire', 'delivery-pending': 'Delivery awaiting receipt', delivered: 'Delivered to a friend', 'world-pending': 'Publication awaiting receipt', published: 'Shared with the stars', unreadable: 'Needs restoration' })[stage];

// One independently written key per letter. There is no shared read/modify/write
// index that could lose a page created concurrently in a different window.
// The original key remains an ordinary entry: legacy receipts and audio never
// need to be copied or deleted as part of an upgrade.
export class LetterLibrary {
  constructor(readonly ownerId: string, private storage: LetterLibraryStorage, private makeId: () => string) {}
  entries(): LetterEntry[] {
    const prefix = `lantern-letter-v1-${encodeURIComponent(this.ownerId)}--`;
    const ids = this.storage.keys().flatMap(key => key === draftKey(this.ownerId) ? [LEGACY_LETTER] : key.startsWith(prefix) && requestIdPattern.test(key.slice(prefix.length)) ? [key.slice(prefix.length)] : []);
    return ids.flatMap<LetterEntry>(id => {
      try {
        const raw = this.storage.read(draftKey(this.ownerId, letterDocumentId(id)));
        if (readRemovedLetter(raw, this.ownerId)) return [];
        const d = decodeDraft(raw, this.ownerId);
        // Captions, recipients and account identifiers never appear in this list.
        const title = terminalStage(d.stage) ? 'A completed journey' : pendingStage(d.stage) ? 'A letter on its journey' : d.kind === 'VOICE' ? 'A voice letter' : d.text.trim().split('\n')[0]?.slice(0, 70) || 'An unwritten letter';
        return { id, title, stage: d.stage, updatedAt: d.updatedAt, cleanup: d.voiceDeletes.length > 0 };
      } catch { return { id, title: 'A letter kept safely', stage: 'unreadable' as const, updatedAt: '', cleanup: false }; }
    }).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }
  prepareRemoval(id: string): RemovalTicket {
    const raw = this.storage.read(draftKey(this.ownerId, letterDocumentId(id)));
    if (!raw || readRemovedLetter(raw, this.ownerId)) throw new LetterRemovalError('unavailable');
    const draft = decodeDraft(raw, this.ownerId);
    if (draft.stage !== 'writing' && draft.stage !== 'sealed') throw new LetterRemovalError('protected');
    return { id, revision: raw, kind: draft.kind };
  }
  remove(ticket: RemovalTicket) {
    const fresh = this.prepareRemoval(ticket.id);
    if (fresh.revision !== ticket.revision) throw new LetterRemovalError('changed');
    const draft = decodeDraft(fresh.revision, this.ownerId);
    // A small content-free marker prevents a stale open editor from recreating
    // a removed page. Audio cleanup is durably queued in the same atomic write.
    this.storage.write(draftKey(this.ownerId, letterDocumentId(ticket.id)), JSON.stringify(removedLetter(draft)));
  }
  create(): string {
    const id = this.makeId().toLowerCase(); const key = draftKey(this.ownerId, id);
    if (this.storage.read(key) !== null) throw new Error('This page already exists.');
    this.storage.write(key, JSON.stringify(newDraft(this.ownerId, this.makeId())));
    this.remember(id); return id;
  }
  private selectionKey() { return `lantern-letter-choice-v1-${encodeURIComponent(this.ownerId)}`; }
  private removalRecords() {
    const prefix = `lantern-letter-v1-${encodeURIComponent(this.ownerId)}--`;
    return this.storage.keys().filter(key => key === draftKey(this.ownerId) || key.startsWith(prefix) && requestIdPattern.test(key.slice(prefix.length))).flatMap(key => {
      const record = readRemovedLetter(this.storage.read(key), this.ownerId);
      return record && record.voiceDeletes.length ? [{ key, record }] : [];
    });
  }
  pendingRemovals() { return this.removalRecords().length; }
  retryRemovalCleanup() { for (const { key, record } of this.removalRecords()) this.storage.write(key, JSON.stringify(record)); }
  remember(id: string) { try { this.storage.write(this.selectionKey(), id); } catch { /* Selection is optional; the letter itself was already saved. */ } }
  open(): string {
    const entries = this.entries(); const preferred = this.storage.read(this.selectionKey());
    const usable = (entry: LetterEntry) => !terminalStage(entry.stage) || entry.cleanup;
    const previous = entries.find(entry => entry.id === preferred && usable(entry));
    // A new visit after a completed journey opens another existing page or a
    // new page. Completed records remain in the cabinet, without cleared words.
    const selected = previous ?? entries.find(usable);
    if (selected) { this.remember(selected.id); return selected.id; }
    // Preserve the first-install key for existing clients and safe v1–v6 upgrades.
    if (!entries.length && this.storage.read(draftKey(this.ownerId)) === null) {
      this.storage.write(draftKey(this.ownerId), JSON.stringify(newDraft(this.ownerId, this.makeId())));
      this.remember(LEGACY_LETTER); return LEGACY_LETTER;
    }
    return this.create();
  }
}
