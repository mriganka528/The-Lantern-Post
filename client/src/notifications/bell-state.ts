import type { PalaceLiveEvent, NotificationStateUpdate } from '@lantern-post/shared-types';
export const bellKey = (ownerId: string) => 'lantern-bell-seen-v1-' + encodeURIComponent(ownerId);
export function isBellArrival(event: PalaceLiveEvent) { return ['LETTER_RECEIVED', 'CHAT_RECEIVED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED'].includes(event.kind); }
interface BellStorage { read(key: string): string | null; write(key: string, value: string): void; subscribe?(key: string, listener: () => void): () => void; }
interface StoredBell { seen: string[]; dismissed: string[]; pendingSeen: string[]; pendingDismissed: string[]; }
const bounded = (ids: string[]) => [...new Set(ids)].slice(-500);
export class BellSeenStore {
  private state: { seen: string[]; dismissed: string[]; error: boolean } = { seen: [], dismissed: [], error: false };
  private listeners = new Set<() => void>();
  constructor(private ownerId: string, private storage: BellStorage) { this.refresh(); }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private read(): StoredBell {
    const raw = this.storage.read(bellKey(this.ownerId)); if (!raw) return { seen: [], dismissed: [], pendingSeen: [], pendingDismissed: [] };
    const value = JSON.parse(raw) as { version?: number; ownerId?: string; seen?: unknown; dismissed?: unknown; pendingSeen?: unknown; pendingDismissed?: unknown };
    const valid = (ids: unknown): ids is string[] => Array.isArray(ids) && ids.length <= 500 && ids.every(id => typeof id === 'string' && id.length > 0 && id.length <= 180);
    const dismissed = value.version === 1 ? [] : value.dismissed;
    const pendingSeen = value.version === 3 ? value.pendingSeen : value.seen;
    const pendingDismissed = value.version === 3 ? value.pendingDismissed : dismissed;
    if (![1,2,3].includes(value.version ?? 0) || value.ownerId !== this.ownerId || !valid(value.seen) || !valid(dismissed) || !valid(pendingSeen) || !valid(pendingDismissed)) throw Error('Invalid bell state');
    return { seen: value.seen, dismissed, pendingSeen, pendingDismissed };
  }
  private publish(value: { seen: string[]; dismissed: string[] }, error: boolean) { const next = { seen: value.seen, dismissed: value.dismissed, error }; if (JSON.stringify(next) === JSON.stringify(this.state)) return; this.state = next; this.listeners.forEach(listener => listener()); }
  private save(value: StoredBell, current: StoredBell) {
    if (JSON.stringify(value) !== JSON.stringify(current) || this.state.error) this.storage.write(bellKey(this.ownerId), JSON.stringify({ version: 3, ownerId: this.ownerId, ...value }));
    this.publish(value, false);
  }
  refresh = () => { try { this.publish(this.read(), false); } catch { this.publish(this.state, true); } };
  private update(ids: string[], dismiss: boolean): boolean {
    if (!ids.length) return true;
    try {
      if (ids.some(id => typeof id !== 'string' || !id || id.length > 180)) throw Error('Invalid notice');
      const current = this.read();
      const value = { seen: bounded([...current.seen, ...ids]), dismissed: dismiss ? bounded([...current.dismissed, ...ids]) : current.dismissed,
        pendingSeen: bounded([...current.pendingSeen, ...ids.filter(id => !current.seen.includes(id))]),
        pendingDismissed: dismiss ? bounded([...current.pendingDismissed, ...ids.filter(id => !current.dismissed.includes(id))]) : current.pendingDismissed };
      this.save(value, current); return true;
    } catch { this.publish(this.state, true); return false; }
  }
  markSeen(ids: string[]) { return this.update(ids, false); }
  dismiss(id: string) { return this.update([id], true); }
  mergeRemoteSeen(ids: string[]) {
    if (!ids.length) return;
    try { const current = this.read(); this.save({ ...current, seen: bounded([...current.seen, ...ids]) }, current); }
    catch { this.publish(this.state, true); }
  }
  pending(): NotificationStateUpdate | null {
    try { const value = this.read(); return { seenIds: value.pendingSeen, dismissedIds: value.pendingDismissed }; }
    catch { this.publish(this.state, true); return null; }
  }
  acknowledge(batch: NotificationStateUpdate): boolean {
    try {
      const current = this.read();
      this.save({ ...current, pendingSeen: current.pendingSeen.filter(id => !batch.seenIds.includes(id)), pendingDismissed: current.pendingDismissed.filter(id => !batch.dismissedIds.includes(id)) }, current);
      return true;
    } catch { this.publish(this.state, true); return false; }
  }
  watch = () => this.storage.subscribe?.(bellKey(this.ownerId), this.refresh) ?? (() => {});
}
