import type { PalaceLiveEvent } from '@lantern-post/shared-types';
export const bellKey = (ownerId: string) => 'lantern-bell-seen-v1-' + encodeURIComponent(ownerId);
export function isBellArrival(event: PalaceLiveEvent) { return ['LETTER_RECEIVED', 'CHAT_RECEIVED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED'].includes(event.kind); }
interface BellStorage { read(key: string): string | null; write(key: string, value: string): void; subscribe?(key: string, listener: () => void): () => void; }
export class BellSeenStore {
  private state: { seen: string[]; error: boolean } = { seen: [], error: false };
  private listeners = new Set<() => void>();
  constructor(private ownerId: string, private storage: BellStorage) { this.refresh(); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private read() {
    const raw = this.storage.read(bellKey(this.ownerId)); if (!raw) return [];
    const value = JSON.parse(raw) as { version?: number; ownerId?: string; seen?: unknown };
    if (value.version !== 1 || value.ownerId !== this.ownerId || !Array.isArray(value.seen) || value.seen.length > 500 || value.seen.some(id => typeof id !== 'string' || !id || id.length > 180)) throw Error('Invalid bell state');
    return value.seen as string[];
  }
  private publish(seen: string[], error: boolean) { if (error === this.state.error && JSON.stringify(seen) === JSON.stringify(this.state.seen)) return; this.state = { seen, error }; this.listeners.forEach(listener => listener()); }
  refresh = () => { try { this.publish(this.read(), false); } catch { this.publish(this.state.seen, true); } };
  markSeen(ids: string[]) {
    if (!ids.length) return;
    try {
      const seen = [...new Set([...this.read(), ...ids])].slice(-500);
      if (JSON.stringify(seen) !== JSON.stringify(this.state.seen) || this.state.error) this.storage.write(bellKey(this.ownerId), JSON.stringify({ version: 1, ownerId: this.ownerId, seen }));
      this.publish(seen, false);
    } catch { this.publish(this.state.seen, true); }
  }
  watch = () => this.storage.subscribe?.(bellKey(this.ownerId), this.refresh) ?? (() => {});
}
