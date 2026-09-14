import { decodeDraft, DraftController, draftKey } from './draft';
import type { LetterLibraryStorage } from './letter-library';
import { requestIdPattern } from './burn-contract';
import { finishRemovedVoiceDelete, readRemovedLetter } from './removed-letter';

// Local deletion only, never an automatic send/retry for an inactive letter.
// The active editor handles its own queue and any visible cleanup error.
export class CabinetCleanup {
  private stopped = false; private running = false; private queued = new Set<string>();
  private unsubscribe: (() => void) | undefined;
  constructor(private ownerId: string, private activeKey: string, private storage: LetterLibraryStorage, private remove: (ownerId: string, id: string) => Promise<void>) {}
  start() {
    this.stopped = false; this.unsubscribe = this.storage.watch?.(key => { if (key) this.changed(key); else this.scan(); }); this.scan();
    return () => { this.stopped = true; this.unsubscribe?.(); this.queued.clear(); };
  }
  private document(key: string): { id?: string } | null {
    if (key === draftKey(this.ownerId)) return {};
    const prefix = `lantern-letter-v1-${encodeURIComponent(this.ownerId)}--`; const id = key.slice(prefix.length);
    return key.startsWith(prefix) && requestIdPattern.test(id) ? { id } : null;
  }
  private scan() { try { for (const key of this.storage.keys()) this.changed(key); } catch { /* Keep queues intact until another visit. */ } }
  private changed(key: string) {
    if (this.stopped || !this.document(key)) return;
    try {
      const raw = this.storage.read(key); const removed = readRemovedLetter(raw, this.ownerId);
      if (key === this.activeKey && !removed) return;
      if (raw && (removed ?? decodeDraft(raw, this.ownerId)).voiceDeletes.length) { this.queued.add(key); void this.drain(); }
    } catch { /* Restoration belongs to that letter. */ }
  }
  private async drain() {
    if (this.running || this.stopped) return; this.running = true;
    try {
      while (!this.stopped && this.queued.size) {
        const key = this.queued.values().next().value!; this.queued.delete(key); const document = this.document(key); if (!document) continue;
        let removed; try { removed = readRemovedLetter(this.storage.read(key), this.ownerId); } catch { continue; }
        if (removed) {
          try { for (const id of removed.voiceDeletes) { if (this.stopped) break; await this.remove(this.ownerId, id); if (this.stopped || !finishRemovedVoiceDelete(this.storage, key, this.ownerId, id)) break; } }
          catch { /* The marker retains its queue for the next visit. */ }
          continue;
        }
        const controller = new DraftController(this.ownerId, this.storage, undefined, document.id); controller.load();
        try {
          while (!this.stopped && controller.getSnapshot().draft?.voiceDeletes.length) {
            const id = controller.getSnapshot().draft!.voiceDeletes[0]!; await this.remove(this.ownerId, id);
            if (this.stopped || !controller.finishVoiceDelete(id)) break;
          }
        } catch { /* Retain the durable queue; reopening offers a visible retry. */ }
      }
    } finally { this.running = false; }
  }
}
