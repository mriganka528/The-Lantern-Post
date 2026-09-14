import type { ChatPage } from '@lantern-post/shared-types';
import { ChatFault, readChatPage } from './chat-contract';
export interface SocketPort { readyState: number; onopen: (() => void) | null; onmessage: ((event: { data: unknown }) => void) | null; onerror: (() => void) | null; onclose: (() => void) | null; send(value: string): void; close(): void; }
export class ChatSocketChannel {
  get closed() { return this.stopped; }
  private socket: SocketPort | null = null; private queue: ChatPage[] = []; private waiter: { resolve(page: ChatPage): void; reject(error: unknown): void } | null = null;
  private stopped = false; private fault: ChatFault | null = null; private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private peer: string, private after: number | null, private url: string, private token: () => Promise<string | null>, private create: (url: string) => SocketPort, private signal: AbortSignal) { signal.addEventListener('abort', this.close, { once: true }); }
  async start() {
    this.timer = setTimeout(() => this.fail(new ChatFault('connection')), 12000);
    const token = await this.token(); if (this.stopped || this.signal.aborted) { this.close(); return; }
    if (!token) { this.fail(new ChatFault('session')); return; }
    const socket = this.create(this.url); this.socket = socket;
    socket.onopen = () => { if (!this.stopped) socket.send(JSON.stringify({ type: 'subscribe', token, peerId: this.peer, after: this.after })); };
    socket.onmessage = event => {
      if (this.stopped) return;
      try {
        if (typeof event.data !== 'string' || event.data.length > 500000) throw new ChatFault('connection'); const value = JSON.parse(event.data) as { type?: string; page?: unknown; reason?: string };
        if (value.type === 'error' && value.reason === 'throttled') throw new ChatFault('throttled');
        if (value.type === 'closed') throw new ChatFault('closed'); if (value.type !== 'page') throw new ChatFault('connection');
        const page = readChatPage(value.page, this.peer); clearTimeout(this.timer); this.timer = setTimeout(() => this.fail(new ChatFault('connection')),25000);
        if (this.waiter) { const waiter = this.waiter; this.waiter = null; waiter.resolve(page); }
        else { if (this.queue.length >= 8) throw new ChatFault('connection'); this.queue.push(page); }
      } catch (error) { this.fail(error instanceof ChatFault ? error : new ChatFault('connection')); }
    };
    socket.onerror = () => this.fail(new ChatFault('connection')); socket.onclose = () => this.fail(new ChatFault('connection'));
  }
  next(): Promise<ChatPage> { if (this.fault || this.stopped) return Promise.reject(this.fault ?? new ChatFault('connection')); const page = this.queue.shift(); if (page) return Promise.resolve(page); return new Promise((resolve, reject) => { this.waiter = { resolve, reject }; }); }
  private fail(error: ChatFault) { if (this.stopped) return; this.fault = error; this.close(); }
  close = () => { if (this.stopped) return; this.stopped = true; clearTimeout(this.timer); this.signal.removeEventListener('abort', this.close); this.queue = []; const socket = this.socket; if (socket) { socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null; socket.close(); } this.waiter?.reject(this.fault ?? new ChatFault('connection')); this.waiter = null; };
}
