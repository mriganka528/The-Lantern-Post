import { Injectable } from '@nestjs/common';

// Wake local listeners immediately; the bounded DB fallback also catches
// messages committed by another API instance. Payloads contain no chat content.
@Injectable()
export class ChatSignal {
  private listeners = new Map<string, Set<() => void>>();
  notify(threadId: string) { this.listeners.get(threadId)?.forEach(listener => listener()); }
  wait(threadId: string, signal?: AbortSignal, milliseconds = 750): Promise<void> {
    return new Promise(resolve => {
      if (signal?.aborted) { resolve(); return; }
      const done = () => { clearTimeout(timer); signal?.removeEventListener('abort', done); const set = this.listeners.get(threadId); set?.delete(done); if (!set?.size) this.listeners.delete(threadId); resolve(); };
      const set = this.listeners.get(threadId) ?? new Set(); set.add(done); this.listeners.set(threadId, set);
      const timer = setTimeout(done, milliseconds); signal?.addEventListener('abort', done, { once: true });
    });
  }
}
