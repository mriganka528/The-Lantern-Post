import type { GetSessionToken } from '../api/client';

export class SessionTokenError extends Error {
  constructor(readonly reason: 'throttled' | 'timeout') { super(reason === 'throttled' ? 'Session refresh is resting. Please try again shortly.' : 'Session refresh timed out.'); this.name = 'SessionTokenError'; }
}

// One coordinator per Clerk client/session, shared by HTTP and both live feeds.
// The SDK owns token caching; this stores only in-flight requests in memory.
export function coordinateSessionToken(source: GetSessionToken): GetSessionToken {
  let normal: Promise<string | null> | null = null;
  let fresh: Promise<string | null> | null = null;
  let blockedUntil = 0;
  async function request(skipCache: boolean) {
    if (Date.now() < blockedUntil) throw new SessionTokenError('throttled');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([source({ skipCache }), new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new SessionTokenError('timeout')), 10_000); })]);
    } catch (error) {
      const problem = error as { status?: number; statusCode?: number; retryAfter?: number; errors?: { code?: string }[] } | null;
      if (problem?.status === 429 || problem?.statusCode === 429 || Array.isArray(problem?.errors) && problem.errors.some(item => item.code === 'too_many_requests' || item.code === 'rate_limit_exceeded')) {
        const seconds = Number(problem.retryAfter);
        blockedUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? Math.min(300, Math.max(1, seconds)) : 60) * 1000;
        throw new SessionTokenError('throttled');
      }
      if (error instanceof SessionTokenError) blockedUntil = Date.now() + 10_000;
      throw error;
    } finally { clearTimeout(timer); }
  }
  return options => {
    if (fresh) return fresh;
    if (options?.skipCache) {
      const work = (normal ? normal.catch(() => null) : Promise.resolve()).then(() => request(true));
      fresh = work.finally(() => { fresh = null; }); return fresh;
    }
    if (!normal) normal = request(false).finally(() => { normal = null; });
    return normal;
  };
}

interface SessionClient { session?: { id: string; getToken: GetSessionToken } | null; }
const clients = new WeakMap<SessionClient, { id: string; token: GetSessionToken }>();
export function tokenForSession(client: SessionClient, sessionId: string | null | undefined): GetSessionToken {
  if (!sessionId) return async () => null;
  const saved = clients.get(client); if (saved?.id === sessionId) return saved.token;
  const bound = bindSessionToken(() => client.session?.id, sessionId, options => client.session?.getToken(options) ?? Promise.resolve(null));
  const token = bindSessionToken(() => client.session?.id, sessionId, coordinateSessionToken(bound));
  clients.set(client, { id: sessionId, token }); return token;
}

export function bindSessionToken(
  readCurrentSession: () => string | null | undefined,
  expectedSession: string | null | undefined,
  getToken: GetSessionToken,
): GetSessionToken {
  return async (options) => {
    if (!expectedSession || readCurrentSession() !== expectedSession) return null;
    const token = await getToken(options);
    // A delayed token refresh from an old screen must never retry that screen's
    // request using a newly signed-in account's credentials.
    return readCurrentSession() === expectedSession ? token : null;
  };
}
