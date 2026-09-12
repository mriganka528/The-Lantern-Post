import { env } from '../config/env';

export type GetSessionToken = (options?: { skipCache?: boolean }) => Promise<string | null>;

export class ApiError extends Error {
  constructor(readonly status: number, readonly code?: string) {
    super(status === 401 ? 'Please sign in again.' : 'We could not complete that request.');
    this.name = 'ApiError';
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, getToken: GetSessionToken, options: ApiOptions = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('An API-relative path is required.');
  const url = new URL(`${env.apiUrl}${path}`);
  if (url.origin !== new URL(env.apiUrl).origin) throw new Error('API origin mismatch.');

  // Refresh once if a cached token expired. Never store bearer tokens in query
  // data, Zustand, logs, URLs, or request bodies.
  for (let attempt = 0; attempt < 2; attempt++) {
    if (options.signal?.aborted) throw new Error('Request cancelled.');
    const token = await getToken({ skipCache: attempt > 0 });
    if (options.signal?.aborted) throw new Error('Request cancelled.');
    if (!token) throw new ApiError(401);
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15_000);
    try {
      const response = await fetch(url.toString(), {
        method: options.method ?? 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}`, ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller.signal,
        redirect: 'error',
      });
      if (response.status === 401 && attempt === 0) continue;
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const code = body && typeof body === 'object' && 'code' in body && typeof body.code === 'string' ? body.code : undefined;
        throw new ApiError(response.status, code);
      }
      return await response.json() as T;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', abort);
    }
  }
  throw new ApiError(401);
}

export function requestErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'USERNAME_TAKEN') return 'Someone has already chosen that name. Try another.';
    if (error.code === 'PROFILE_EXISTS') return 'Your account already has a username. Refresh to continue.';
    if (error.code === 'PROFILE_REQUIRED') return 'Choose your username before meeting the companions.';
    if (error.code === 'CHARACTER_UNAVAILABLE') return 'This companion is resting for now. Please choose another.';
    if (error.code === 'PALACE_UNAVAILABLE') return 'We could not find this palace. You can choose another companion.';
    if (error.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.status === 400) return 'Please check your details and try again.';
    if (error.status >= 500) return 'Lantern Post is temporarily unavailable. Please try again in a moment.';
  }
  return 'We could not connect. Check your connection and try again.';
}
