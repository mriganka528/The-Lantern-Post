import { env } from '../config/env';
import { SessionTokenError } from '../auth/session-token';

export type GetSessionToken = (options?: { skipCache?: boolean }) => Promise<string | null>;

export class ApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(status === 401 ? 'Please sign in again.' : 'We could not complete that request.');
    this.name = 'ApiError';
  }
}

export class ApiTimeoutError extends Error {
  constructor() { super('The request took too long. Please try again.'); this.name = 'ApiTimeoutError'; }
}

// Token refresh can stall before fetch starts. Bound every await, including
// authentication and response reading, and ignore late results after cancellation.
function untilAborted<T>(work: Promise<T>, signal: AbortSignal, failure: () => Error): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(failure());
    if (signal.aborted) { reject(failure()); void work.catch(() => {}); return; }
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

interface ApiOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  binary?: {bytes:Uint8Array;mimeType:'audio/webm'|'audio/mp4'};
}

export async function apiRequest<T>(path: string, getToken: GetSessionToken, options: ApiOptions = {}): Promise<T> {
  if(options.binary&&(options.body!==undefined||options.method!=='POST'||!/^\/voice\/uploads\/voice_[a-f0-9]{64}\/content$/.test(path)||!['audio/webm','audio/mp4'].includes(options.binary.mimeType)||options.binary.bytes.length<64||options.binary.bytes.length>8*1024*1024))throw new Error('Invalid recording upload.');
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('An API-relative path is required.');
  const url = new URL(`${env.apiUrl}${path}`);
  if (url.origin !== new URL(env.apiUrl).origin) throw new Error('API origin mismatch.');

  const controller = new AbortController(); let timedOut = false;
  const failure = () => timedOut ? new ApiTimeoutError() : new Error('Request cancelled.');
  const abort = () => controller.abort();
  if (options.signal?.aborted) throw failure();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => { timedOut = true; abort(); }, options.binary ? 60_000 : 15_000);
  const wait = <R,>(work: Promise<R>) => untilAborted(work, controller.signal, failure);
  try {
    // Refresh once if a cached token expired. Never store bearer tokens in query
    // data, Zustand, logs, URLs, or request bodies.
    for (let attempt = 0; attempt < 2; attempt++) {
      if (controller.signal.aborted) throw failure();
      const token = await wait(getToken({ skipCache: attempt > 0 }));
      if (controller.signal.aborted) throw failure();
      if (!token) throw new ApiError(401);
      const response = await wait(fetch(url.toString(), {
        method: options.method ?? 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.binary?{'Content-Type':options.binary.mimeType}:options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: options.binary?new Uint8Array(options.binary.bytes).buffer:options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        redirect: 'error',
      }));
      if (response.status === 401 && attempt === 0) { void response.body?.cancel().catch(() => {}); continue; }
      if (!response.ok) {
        const body: unknown = await wait(response.json().catch(() => null));
        const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code : undefined;
        throw new ApiError(response.status, code);
      }
      return await wait(response.json()) as T;
    }
    throw new ApiError(401);
  } catch (error) {
    if (error instanceof SessionTokenError) {
      if (error.reason === 'throttled') throw new ApiError(429);
      throw new ApiTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}

export function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiTimeoutError) return 'The palace post is taking too long. Please check your connection and try again.';
  if (error instanceof ApiError) {
    if (error.code === 'USERNAME_TAKEN') return 'Someone has already chosen that name. Try another.';
    if (error.code === 'PROFILE_EXISTS') return 'Your account already has a username. Refresh to continue.';
    if (error.code === 'PROFILE_REQUIRED') return 'Choose your username before meeting the companions.';
    if (error.code === 'CHARACTER_UNAVAILABLE') return 'This companion is resting for now. Please choose another.';
    if (error.code === 'PALACE_UNAVAILABLE') return 'We could not find this palace. You can choose another companion.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 429) return 'The palace post needs a short rest. Please wait a minute, then try again.';
    if (error.status === 400) return 'Please check your details and try again.';
    if (error.status >= 500) return 'Lantern Post is temporarily unavailable. Please try again in a moment.';
  }
  return 'We could not connect. Check your connection and try again.';
}
