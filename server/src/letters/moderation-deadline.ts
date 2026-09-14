import type { ContentDecision } from './content-review';
// A future live provider must honor this signal;
// even if it ignores cancellation, a late approval cannot resume delivery.
export async function moderationDecision(check: (signal: AbortSignal) => Promise<unknown>, milliseconds = 8000): Promise<ContentDecision> {
  const abort = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { abort.abort(); reject(new Error('Letter check timed out')); }, milliseconds); });
    const outcome = await Promise.race([Promise.resolve().then(() => check(abort.signal)), timeout]);
    if (outcome !== 'APPROVED' && outcome !== 'REJECTED' && outcome !== 'NOT_REQUIRED') throw new Error('Invalid letter check outcome');
    return outcome;
  } finally { clearTimeout(timer); abort.abort(); }
}
