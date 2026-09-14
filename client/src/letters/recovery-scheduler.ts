// A foreground queue for already-confirmed, durably saved intents. Receipt
// lookup always precedes a retry; previews and ordinary sealed drafts never run.
export interface RecoveryWork { identity(): string | null; busy(): boolean; check(): Promise<void>; permitted(): Promise<boolean>; retry(): Promise<void>; }
export class RecoveryScheduler {
  private generation = 0; private running = false;
  constructor(private readonly work: RecoveryWork) {}
  stop() { this.generation++; }
  async resume(): Promise<boolean> {
    const id = this.work.identity(); if (!id || this.running || this.work.busy()) return false;
    const generation = this.generation; this.running = true;
    const current = () => this.generation === generation && this.work.identity() === id;
    try { await this.work.check(); if (current() && !this.work.busy() && await this.work.permitted() && current()) await this.work.retry(); return current(); }
    catch { return current(); }
    finally { this.running = false; }
  }
}
