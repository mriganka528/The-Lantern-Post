import type { WorldCapabilities, WorldReceipt, WorldReceiptResponse } from '@lantern-post/shared-types';
import type { DraftController } from '../letters/draft';
import type { PendingWorldLetter } from './world-contract';
import { readWorldReceipt } from './world-contract';
export interface WorldDeliveryTransport { submit(input: PendingWorldLetter): Promise<WorldReceipt>; lookup(id: string): Promise<WorldReceiptResponse>; cancel(id: string, isSigned: boolean): Promise<WorldReceipt>; capabilities(signal?: AbortSignal): Promise<WorldCapabilities>; }
interface Snapshot { busy: boolean; error: string | null; outcome?: 'DELIVERED' | 'REJECTED'; }
export class WorldController {
  private state: Snapshot = { busy: false, error: null }; private listeners = new Set<() => void>(); private task: Promise<void> | null = null;
  constructor(private readonly draft: DraftController, private readonly api: WorldDeliveryTransport, private readonly makeId: () => string) {}
  getSnapshot = () => this.state;
  subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
  private publish(value: Snapshot) { this.state = value; this.listeners.forEach(fn => fn()); }
  clearNotice() { if (!this.task) this.publish({ busy: false, error: null }); }
  confirm() { if (this.task) return this.task; if (!this.draft.beginWorld(this.makeId())) { this.publish({ busy: false, error: 'Save your sealed letter before sharing it.' }); return Promise.resolve(); } return this.run('send'); }
  retry() { return this.run('send'); } check() { return this.run('check'); } cancel() { return this.run('cancel'); }
  retryCleanup() { const saved = this.draft.retrySave(); this.publish({ busy: false, error: saved ? null : 'Your light has joined the sky. This device still needs to finish clearing its local copy.' }); }
  private run(action: 'send' | 'check' | 'cancel'): Promise<void> {
    if (this.task) return this.task; const input = this.draft.pendingWorld(); if (!input) return Promise.resolve(); this.publish({ busy: true, error: null });
    const task = (async () => { try {
      const result = action === 'send' ? await this.api.submit(input) : action === 'cancel' ? await this.api.cancel(input.requestId, input.isSigned) : (await this.api.lookup(input.requestId)).receipt;
      if (!result) { this.publish({ busy: false, error: 'Sharing is not confirmed. Check again, retry the same letter, or cancel and keep it.' }); return; }
      const receipt = readWorldReceipt(result, input.requestId, input.isSigned); if (!receipt) throw new Error('Unconfirmed sky outcome');
      const saved = this.draft.applyWorldReceipt(receipt); this.publish({ busy: false, outcome: receipt.outcome, error: saved ? null : 'The sky replied, but this device could not finish saving the outcome. Please retry cleanup.' });
    } catch (error) { const code = error && typeof error === 'object' && 'code' in error ? error.code : null; this.publish({ busy: false, error: code === 'VOICE_STORAGE_FULL' ? 'The recording cabinet is full for now. Your recording stays here; you can cancel sharing and try later.' : code === 'MODERATION_UNAVAILABLE' ? 'Public sharing is resting. This letter has not been confirmed; you can cancel and keep it.' : 'We could not confirm sharing. Your letter stays sealed. Check its status or retry in a little while.' }); }
    })(); this.task = task; void task.finally(() => { if (this.task === task) this.task = null; }); return task;
  }
}
