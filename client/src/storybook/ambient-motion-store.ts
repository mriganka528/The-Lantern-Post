export interface MotionStorage { read(): string | null; write(value: string): void; subscribe?(listener: () => void): () => void; }
export class AmbientMotionStore {
  private enabled = true;
  private listeners = new Set<() => void>();
  constructor(private readonly storage: MotionStorage) { this.refresh(); }
  getSnapshot = () => this.enabled;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  refresh = () => {
    try { this.publish(this.storage.read() !== 'off'); } catch { /* Keep the current choice if device storage is unavailable. */ }
  };
  private publish(enabled: boolean) { if (enabled !== this.enabled) { this.enabled = enabled; this.listeners.forEach(listener => listener()); } }
  setEnabled = (enabled: boolean) => {
    try { this.storage.write(enabled ? 'on' : 'off'); } catch { /* The choice still takes effect for this session. */ }
    this.publish(enabled);
  };
  watch() { return this.storage.subscribe?.(this.refresh) ?? (() => {}); }
}
