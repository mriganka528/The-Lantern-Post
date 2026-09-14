import type { ChatMessage, ChatPage, FriendPerson,ChatReceipt } from '@lantern-post/shared-types';
import { ChatFault, chatProblem, mergeMessages } from './chat-contract';
import type { ChatTransport } from './chat-contract';
import type { ChatDraftController } from './chat-draft';
interface Snapshot { phase: 'loading' | 'ready' | 'offline' | 'closed'; peer: FriendPerson | null; messages: ChatMessage[]; cursor: number; before: number | null; available: boolean; connected: boolean; sending: boolean; error: string | null; }
const pause = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => { if (signal.aborted) { resolve(); return; } const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); }; const timer = setTimeout(done, ms); signal.addEventListener('abort', done, { once: true }); });
export class ChatSession {
  private state: Snapshot = { phase: 'loading', peer: null, messages: [], cursor: 0, before: null, available: false, connected: false, sending: false, error: null };
  private listeners = new Set<() => void>(); private generation = 0; private abort: AbortController | null = null; private busy = false;
  private opening = 0; private recovering: number | null = null;
  constructor(readonly peerId: string, private api: ChatTransport, private draft: ChatDraftController, private makeId: () => string) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(value: Partial<Snapshot>) { this.state = { ...this.state, ...value }; this.listeners.forEach(listener => listener()); }
  private current(generation: number) { return generation === this.generation && Boolean(this.abort && !this.abort.signal.aborted); }
  private confirmOwnMessage(receipt:ChatReceipt,text:string){if(receipt.outcome==='DELIVERED'&&receipt.messageId&&receipt.sequence){this.publish({messages:mergeMessages(this.state.messages,[{id:receipt.messageId,sequence:receipt.sequence,side:'mine',text,createdAt:receipt.completedAt}])});}/* The stream cursor advances only on ordered server pages, so earlier incoming messages cannot be skipped. */}
  start() { this.stop(); this.abort = new AbortController(); const generation = ++this.generation; void this.listen(generation, this.abort.signal); }
  stop() { this.generation++; this.abort?.abort(); this.abort = null; this.busy = false; this.recovering = null; this.publish({ connected: false, sending: false }); }
  private fail(error: unknown) {
    if (error instanceof ChatFault && ['closed', 'session'].includes(error.kind)) { this.stop(); this.publish({ phase: 'closed', peer: null, messages: [], cursor: 0, before: null, available: false, connected: false, error: chatProblem(error) }); return true; }
    this.publish({ phase: 'offline', connected: false, error: chatProblem(error) }); return false;
  }
  private async listen(generation: number, signal: AbortSignal) {
    let attempts = 0; let opened = false;
    while (this.current(generation)) {
      try {
        const opening = ++this.opening;
        const resuming = opened && Boolean(this.api.open);
        const page = await (this.api.open ? this.api.open(this.peerId, signal, resuming ? this.state.cursor : undefined) : this.api.history(this.peerId, undefined, signal));
        if (!this.current(generation)) return;
        const messages = resuming ? mergeMessages(this.state.messages, page.messages) : page.messages;
        const before = resuming ? messages[0] && messages[0].sequence > 1 ? messages[0].sequence : this.state.before : page.before;
        this.publish({ phase: 'ready', peer: page.peer, messages, cursor: resuming ? Math.max(this.state.cursor, page.cursor) : page.cursor, before, available: page.capabilities?.textAvailable ?? false, connected: true, error: null }); attempts = 0; opened = true;
        // Older servers/transports may omit availability. Display their history
        // immediately and check it separately, without holding the live stream.
        if (!page.capabilities) void this.api.capabilities(signal).then(caps => { if (this.current(generation) && this.opening === opening) this.publish({ available: caps.textAvailable }); }).catch(error => { if (this.current(generation) && this.opening === opening) { if (error instanceof ChatFault && ['closed', 'session'].includes(error.kind)) this.fail(error); else this.publish({ error: chatProblem(error) }); } });
        void this.recover(generation);
        while (this.current(generation)) {
          const update = await this.api.poll(this.peerId, this.state.cursor, signal); if (!this.current(generation)) return;
          const messages = mergeMessages(this.state.messages, update.messages);
          this.publish({ peer: update.peer, messages, cursor: Math.max(this.state.cursor, update.cursor), before: messages[0] && messages[0].sequence > 1 ? messages[0].sequence : null, phase: 'ready', connected: true, ...(update.capabilities ? { available: update.capabilities.textAvailable } : {}), error: null });
          if (this.draft.pending() && !this.busy) void this.recover(generation);
        }
      } catch (error) { if (!this.current(generation)) return; if (this.fail(error)) return; await pause(Math.min(8000, 1000 * 2 ** attempts++), signal); }
    }
  }
  async send() {
    const generation = this.generation;
    if (!this.current(generation) || this.busy || this.state.phase !== 'ready' || !this.state.available || !this.draft.confirm(this.makeId())) return;
    await this.submit(generation);
  }
  private async submit(generation: number) {
    const pending = this.draft.pending(); const signal = this.abort?.signal;
    if (!pending || this.busy || !signal || !this.current(generation) || !this.draft.getSnapshot().saved) return;
    this.busy = true; this.publish({ sending: true, error: null });
    try { const receipt = await this.api.send(this.peerId, pending, signal); if (this.current(generation)) { this.confirmOwnMessage(receipt,pending.text);this.draft.apply(receipt); if (receipt.reason === 'FRIEND_UNAVAILABLE') this.fail(new ChatFault('closed')); } }
    catch (error) { if (this.current(generation)) { this.publish({ error: chatProblem(error) }); if (error instanceof ChatFault && error.kind === 'moderation') this.publish({ available: false }); } }
    finally { if (this.current(generation)) { this.busy = false; this.publish({ sending: false }); } }
  }
  async recover(generation = this.generation) {
    const pending = this.draft.pending(); const signal = this.abort?.signal;
    if (!pending || this.busy || this.recovering === generation || !signal || !this.current(generation) || !this.draft.getSnapshot().saved) return;
    this.recovering = generation;
    try {
      const result = await this.api.receipt(this.peerId, pending.requestId, signal); if (!this.current(generation)) return;
      if (result) { this.confirmOwnMessage(result,pending.text);this.draft.apply(result); this.publish({ sending: false }); }
      else if (this.state.phase === 'ready') { const caps = await this.api.capabilities(signal); if (!this.current(generation)) return; this.publish({ available: caps.textAvailable }); if (caps.textAvailable) await this.submit(generation); }
    } catch (error) { if (this.current(generation)) this.publish({ error: chatProblem(error) }); }
    finally { if (this.recovering === generation) this.recovering = null; }
  }
  async cancel() {
    const pending = this.draft.pending(); const generation = this.generation; const signal = this.abort?.signal;
    if (!pending || !signal || !this.current(generation)) return;
    try { const result = await this.api.cancel(this.peerId, pending.requestId, signal); if (this.current(generation)) this.draft.apply(result); }
    catch (error) { if (this.current(generation)) this.publish({ error: chatProblem(error) }); }
  }
  async earlier(before: number): Promise<ChatPage | null> {
    const generation = this.generation; const signal = this.abort?.signal; if (!signal || !this.current(generation)) return null;
    try { const result = await this.api.history(this.peerId, before, signal); return this.current(generation) ? result : null; }
    catch (error) { if (this.current(generation)) this.fail(error); return null; }
  }
}
