import type { ChatReceipt, ChatSendRequest } from '@lantern-post/shared-types';
import type { DraftStorage } from '../letters/draft';
import { readChatReceipt, validChatRequestId, validMessage } from './chat-contract';
interface ChatDraft { version: 1; ownerId: string; peerId: string; text: string; requestId: string | null; }
interface Snapshot { phase: 'loading' | 'ready' | 'error'; draft: ChatDraft | null; saved: boolean; notice: string | null; }
export class ChatDraftController {
  readonly key: string; private raw: string | null = null; private listeners = new Set<() => void>();
  private state: Snapshot = { phase: 'loading', draft: null, saved: true, notice: null };
  constructor(readonly ownerId: string, readonly peerId: string, private storage: DraftStorage) { this.key = 'lantern-chat-v1-' + encodeURIComponent(JSON.stringify([ownerId, peerId])); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(state: Snapshot) { this.state = state; this.listeners.forEach(listener => listener()); }
  load() {
    try {
      this.raw = this.storage.read(this.key);
      const d: ChatDraft = this.raw === null ? { version: 1, ownerId: this.ownerId, peerId: this.peerId, text: '', requestId: null } : JSON.parse(this.raw) as ChatDraft;
      if (d.version !== 1 || d.ownerId !== this.ownerId || d.peerId !== this.peerId || typeof d.text !== 'string' || Array.from(d.text).length > 2000 || d.requestId !== null && (!validChatRequestId(d.requestId) || !validMessage(d.text))) throw Error('Invalid draft');
      this.publish({ phase: 'ready', draft: d, saved: true, notice: null });
    } catch { this.publish({ phase: 'error', draft: null, saved: false, notice: 'Your saved message could not be restored. Please try again.' }); }
  }
  watch() { return this.storage.subscribe?.(this.key, () => { try { if (this.storage.read(this.key) !== this.raw) this.load(); } catch { this.publish({ ...this.state, saved: false }); } }) ?? (() => {}); }
  private commit(draft: ChatDraft, requireSaved = false): boolean {
    try {
      if (this.storage.read(this.key) !== this.raw) { this.load(); this.publish({ ...this.state, notice: 'This message changed in another window. The saved version is shown here.' }); return false; }
      const raw = JSON.stringify(draft); this.storage.write(this.key, raw); this.raw = raw; this.publish({ phase: 'ready', draft, saved: true, notice: null }); return true;
    } catch { this.publish({ ...this.state, draft: requireSaved ? this.state.draft : draft, saved: false, notice: 'Your words could not be saved. Keep this window open and retry.' }); return false; }
  }
  edit(text: string) { const d = this.state.draft; if (d && !d.requestId && Array.from(text).length <= 2000) this.commit({ ...d, text }); }
  confirm(requestId: string) { const d = this.state.draft; return Boolean(d && !d.requestId && this.state.saved && validMessage(d.text) && validChatRequestId(requestId) && this.commit({ ...d, requestId: requestId.toLowerCase(), text: d.text.trim() }, true)); }
  pending(): ChatSendRequest | null { const d = this.state.draft; return d?.requestId ? { requestId: d.requestId, text: d.text, confirmed: true } : null; }
  retrySave() { return this.state.draft ? this.commit(this.state.draft, true) : false; }
  apply(value: ChatReceipt) {
    const d = this.state.draft; if (!d?.requestId || value.requestId !== d.requestId) return false;
    const result = readChatReceipt(value, d.requestId, this.peerId);
    const saved = this.commit({ ...d, requestId: null, text: result.outcome === 'DELIVERED' ? '' : d.text }, true);
    if (saved && result.outcome === 'REJECTED') this.publish({ ...this.state, notice: result.reason === 'CANCELLED' ? 'The send was cancelled. Your words are still here.' : result.reason === 'CONTENT_NOT_ALLOWED' ? 'This message could not be delivered. You can revise your words.' : result.reason === 'DAILY_LIMIT' ? 'The post has carried your messages for today. Your words are kept here.' : 'This friendship gate is closed. Your words have been kept.' });
    return saved;
  }
}
