import type { NotificationStateUpdate } from '@lantern-post/shared-types';
import type { BellSeenStore } from './bell-state';

export class BellSync {
  private state = { busy: false, error: false };
  private listeners = new Set<() => void>();
  private active = false;
  private generation = 0;
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unwatch: (() => void) | undefined;
  constructor(private store: BellSeenStore, private send: (batch: NotificationStateUpdate, signal: AbortSignal) => Promise<void>) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(busy: boolean, error: boolean) { if (this.state.busy === busy && this.state.error === error) return; this.state = { busy, error }; this.listeners.forEach(listener => listener()); }
  start() { this.active = true; this.unwatch?.(); this.unwatch = this.store.subscribe(() => this.schedule()); this.schedule(); }
  stop() { this.active = false; this.generation++; this.abort?.abort(); this.abort = null; clearTimeout(this.timer); this.timer = undefined; this.unwatch?.(); this.unwatch = undefined; this.publish(false, this.state.error); }
  retry = () => { if (!this.active) return; clearTimeout(this.timer); this.timer = undefined; this.schedule(); };
  private schedule(delay = 150) {
    if (!this.active || this.abort || this.timer) return;
    this.timer = setTimeout(() => { this.timer = undefined; void this.flush(); }, delay);
  }
  async flush() {
    if (!this.active || this.abort) return;
    const batch = this.store.pending();
    if (!batch) { this.publish(false, true); this.schedule(30000); return; }
    if (!batch.seenIds.length && !batch.dismissedIds.length) { this.publish(false, false); return; }
    const abort = new AbortController(); this.abort = abort; const generation = this.generation;
    const current = () => this.active && generation === this.generation && !abort.signal.aborted;
    this.publish(true, false); let failed = false;
    try {
      await this.send(batch, abort.signal);
      if (!current()) return;
      if (!this.store.acknowledge(batch)) throw Error('Notification state could not be saved');
    } catch { failed = true; }
    finally {
      if (current()) { this.abort = null; this.publish(false, failed); this.schedule(failed ? 30000 : 150); }
    }
  }
}
