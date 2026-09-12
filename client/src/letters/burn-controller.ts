import type { BurnLetterRequest, BurnReceipt, BurnReceiptResponse } from '@lantern-post/shared-types';
import type { DraftController } from './draft';
import { readBurnReceipt } from './burn-contract';

export interface BurnTransport {
  submit: (request: BurnLetterRequest) => Promise<BurnReceipt>;
  lookup: (requestId: string) => Promise<BurnReceiptResponse>;
}
interface BurnSnapshot { busy: boolean; error: string | null; outcome?: 'BURNED' | 'REJECTED'; }

export class BurnController {
  private snapshot: BurnSnapshot = { busy: false, error: null };
  private listeners = new Set<() => void>();
  private inFlight: Promise<void> | null = null;
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(snapshot: BurnSnapshot) { this.snapshot = snapshot; this.listeners.forEach(listener => listener()); }
  constructor(private readonly draft: DraftController, private readonly transport: BurnTransport, private readonly makeRequestId: () => string) {}
  clearNotice() { if (!this.inFlight) this.publish({ busy: false, error: null }); }

  confirm(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (!this.draft.beginBurn(this.makeRequestId())) {
      this.publish({ busy: false, error: 'Your letter could not be prepared for release. Save it and try again.' });
      return Promise.resolve();
    }
    return this.run(false);
  }
  retry() { return this.run(false); }
  check() { return this.run(true); }
  retryCleanup() {
    const saved = this.draft.retrySave();
    this.publish({ busy: false, error: saved ? null : 'The fire has received your letter, but this device could not finish clearing its local copy. Please try again.' });
  }
  private run(checkOnly: boolean): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const request = this.draft.pendingBurn();
    if (!request) return Promise.resolve();
    this.publish({ busy: true, error: null });
    const task = (async () => {
      try {
        const result = checkOnly ? (await this.transport.lookup(request.requestId)).receipt : await this.transport.submit(request);
        if (result === null) {
          this.publish({ busy: false, error: 'Your release has not been confirmed. Retry when you are connected; your letter will stay sealed until we know.' });
          return;
        }
        const receipt = readBurnReceipt(result, request.requestId);
        if (!receipt) throw new Error('Unconfirmed response');
        const saved = this.draft.applyBurnReceipt(receipt);
        this.publish({ busy: false, outcome: receipt.outcome, error: saved ? null : 'We received the result, but could not finish saving it on this device. Please try again.' });
      } catch (error) {
        const expired = error && typeof error === 'object' && 'status' in error && error.status === 401;
        this.publish({ busy: false, error: expired ? 'Please sign in again, then check this release. Your letter stays sealed while its outcome is unknown.' : 'We couldn’t confirm the release. Check your connection and retry; we will check the same letter safely.' });
      }
    })();
    this.inFlight = task;
    void task.finally(() => { if (this.inFlight === task) this.inFlight = null; });
    return task;
  }
}
