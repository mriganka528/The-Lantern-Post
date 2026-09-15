import type { PalaceLiveEvent } from '@lantern-post/shared-types';
export const bellKey = (ownerId: string) => 'lantern-bell-seen-v1-' + encodeURIComponent(ownerId);
export function isBellArrival(event: PalaceLiveEvent) { return ['LETTER_RECEIVED', 'CHAT_RECEIVED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED'].includes(event.kind); }
interface BellStorage { read(key: string): string | null; write(key: string, value: string): void; subscribe?(key: string, listener: () => void): () => void; }
export class BellSeenStore {
  private state: { seen: string[]; dismissed: string[]; error: boolean } = { seen: [], dismissed: [], error: false };
  private listeners = new Set<() => void>();
  constructor(private ownerId: string, private storage: BellStorage) { this.refresh(); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private read() {
    const raw = this.storage.read(bellKey(this.ownerId)); if (!raw) return { seen: [], dismissed: [] };
    const value = JSON.parse(raw) as { version?: number; ownerId?: string; seen?: unknown; dismissed?: unknown };
    const valid = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length <= 500 && ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 180);
    const dismissed = value.version === 1 ? [] : value.dismissed;
    if (![1,2].includes(value.version ?? 0) || value.ownerId !== this.ownerId || !valid(value.seen) || !valid(dismissed)) throw Error('Invalid bell state');
    return { seen: value.seen, dismissed };
  }
  private publish(value: { seen: string[]; dismissed: string[] }, error: boolean) { const next = { ...value, error }; if (JSON.stringify(next) === JSON.stringify(this.state)) return; this.state = next; this.listeners.forEach(listener => listener()); }
  refresh = () => { try { this.publish(this.read(), false); } catch { this.publish(this.state, true); } };
  private update(ids: string[], dismiss: boolean): boolean {
    if (!ids.length) return true;
    try {
      if (ids.some(id => typeof id !== 'string' || !id || id.length > 180)) throw Error('Invalid notice');
      const current = this.read();
      const value = { seen: [...new Set([...current.seen, ...ids])].slice(-500), dismissed: dismiss ? [...new Set([...current.dismissed, ...ids])].slice(-500) : current.dismissed };
      if (JSON.stringify(value) !== JSON.stringify(current) || this.state.error) this.storage.write(bellKey(this.ownerId), JSON.stringify({ version: 2, ownerId: this.ownerId, ...value }));
      this.publish(value, false); return true;
    } catch { this.publish(this.state, true); return false; }
  }
  markSeen(ids: string[]) { return this.update(ids, false); }
  dismiss(id: string) { return this.update([id], true); }
  watch = () => this.storage.subscribe?.(bellKey(this.ownerId), this.refresh) ?? (() => {});
}
