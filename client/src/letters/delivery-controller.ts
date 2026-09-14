import type { DeliveryCapabilities, DeliveryReceipt, DeliveryReceiptResponse, LetterRecipient } from '@lantern-post/shared-types';
import type { DraftController, PendingFriendDelivery } from './draft';
import { readDeliveryReceipt } from './delivery-contract';

export interface DeliveryTransport {
  submit(input: PendingFriendDelivery): Promise<DeliveryReceipt>;
  lookup(requestId: string): Promise<DeliveryReceiptResponse>;
  cancel(requestId: string, recipientId: string): Promise<DeliveryReceipt>;
  capabilities(signal?: AbortSignal): Promise<DeliveryCapabilities>;
}
interface DeliverySnapshot { busy: boolean; error: string | null; outcome?: 'DELIVERED' | 'REJECTED'; }
export class DeliveryController {
  private snapshot: DeliverySnapshot = { busy: false, error: null };
  private listeners = new Set<() => void>();
  private inFlight: Promise<void> | null = null;
  constructor(private readonly draft: DraftController, private readonly api: DeliveryTransport, private readonly makeId: () => string) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: DeliverySnapshot) { this.snapshot = value; this.listeners.forEach(listener => listener()); }
  clearNotice() { if (!this.inFlight) this.publish({ busy: false, error: null }); }
  confirm(recipient: LetterRecipient) {
    if (this.inFlight) return this.inFlight;
    if (!this.draft.beginDelivery(this.makeId(), recipient)) { this.publish({ busy: false, error: 'Your letter could not be prepared for delivery. Save it and try again.' }); return Promise.resolve(); }
    return this.run('send');
  }
  check() { return this.run('check'); }
  retry() { return this.run('send'); }
  cancel() { return this.run('cancel'); }
  retryCleanup() { const saved = this.draft.retrySave(); this.publish({ busy: false, error: saved ? null : 'Your letter was delivered, but this device could not finish saving the result. Please try again.' }); }
  private run(action: 'send' | 'check' | 'cancel'): Promise<void> {
    if (this.inFlight) return this.inFlight;
    const request = this.draft.pendingDelivery(); if (!request) return Promise.resolve();
    this.publish({ busy: true, error: null });
    const task = (async () => {
      try {
        const result = action === 'check' ? (await this.api.lookup(request.requestId)).receipt : action === 'cancel' ? await this.api.cancel(request.requestId, request.recipientId) : await this.api.submit(request);
        if (result === null) { this.publish({ busy: false, error: 'This delivery has not been confirmed. You can check again, retry, or ask the post to cancel it.' }); return; }
        const receipt = readDeliveryReceipt(result, request.requestId, request.recipientId); if (!receipt) throw new Error('Mismatched receipt');
        const saved = this.draft.applyDeliveryReceipt(receipt);
        this.publish({ busy: false, outcome: receipt.outcome, error: saved ? null : 'The reply arrived, but this device could not finish saving it. Please try again.' });
      } catch (error) {
        if (error && typeof error === 'object' && 'status' in error && error.status === 429) { this.publish({ busy: false, error: 'The palace post needs a short rest. Your letter stays sealed. Wait a minute before retrying, or check its status.' }); return; }
        const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
        if(code==='VOICE_STORAGE_FULL'){this.publish({busy:false,error:'The recording cabinet is full for now. Your recording stays here; you can cancel this delivery and try later.'});return;}
        const expired = ['VOICE_UPLOAD_EXPIRED', 'VOICE_UPLOAD_MISMATCH', 'VOICE_INVALID'].includes(String(code));
        this.publish({ busy: false, error: expired ? 'The recording upload could not be used. Cancel this delivery to keep your recording, then start a fresh delivery or record again.' : code === 'MODERATION_UNAVAILABLE' ? 'The palace post cannot check this letter right now. It stays sealed here; you can cancel this delivery and keep it.' : 'We couldn’t confirm the delivery. Check its status or retry the same letter when you are connected.' });
      }
    })();
    this.inFlight = task; void task.finally(() => { if (this.inFlight === task) this.inFlight = null; }); return task;
  }
}
