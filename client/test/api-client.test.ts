import assert from 'node:assert/strict';
import { after, afterEach, before, test } from 'node:test';
import { clerkErrorMessage } from '../src/auth/clerk-errors';
import { bindSessionToken } from '../src/auth/session-token';

let api: typeof import('../src/api/client');
const originalFetch = globalThis.fetch;
const originalApiUrl = process.env.EXPO_PUBLIC_API_URL;
const originalPublishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const originalDev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');

before(async () => {
  process.env.EXPO_PUBLIC_API_URL = 'https://api.example.invalid';
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk';
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  api = await import('../src/api/client');
});

afterEach(() => { globalThis.fetch = originalFetch; });
after(() => {
  if (originalApiUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL; else process.env.EXPO_PUBLIC_API_URL = originalApiUrl;
  if (originalPublishableKey === undefined) delete process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = originalPublishableKey;
  if (originalDev) Object.defineProperty(globalThis, '__DEV__', originalDev); else Reflect.deleteProperty(globalThis, '__DEV__');
});

test('an expired cached token is refreshed once and sent only in the authorization header', async () => {
  const tokenOptions: boolean[] = [];
  const requests: string[] = [];
  globalThis.fetch = async (input, init) => {
    const headers = new Headers(init?.headers);
    requests.push(headers.get('Authorization') ?? '');
    assert.equal(input.toString(), 'https://api.example.invalid/users/me');
    assert.equal(init?.body, undefined);
    return requests.length === 1 ? Response.json({}, { status: 401 }) : Response.json({ user: null });
  };
  const result = await api.apiRequest('/users/me', async (options) => {
    tokenOptions.push(Boolean(options?.skipCache));
    return options?.skipCache ? 'fresh-token' : 'cached-token';
  });
  assert.deepEqual(result, { user: null });
  assert.deepEqual(tokenOptions, [false, true]);
  assert.deepEqual(requests, ['Bearer cached-token', 'Bearer fresh-token']);
});

test('a rejected refreshed session stops after two requests', async () => {
  let count = 0;
  globalThis.fetch = async () => { count++; return Response.json({}, { status: 401 }); };
  await assert.rejects(api.apiRequest('/users/me', async () => 'invalid-token'), (error: unknown) => error instanceof api.ApiError && error.status === 401);
  assert.equal(count, 2);
});

test('signed-out and cancelled requests never send a bearer token', async () => {
  globalThis.fetch = async () => { throw new Error('No request should be made'); };
  await assert.rejects(api.apiRequest('/users/me', async () => null), (error: unknown) => error instanceof api.ApiError && error.status === 401);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(api.apiRequest('/users/me', async () => { throw new Error('Token must not be read'); }, { signal: controller.signal }), /cancelled/);
});

test('absolute and protocol-relative URLs cannot exfiltrate a session token', async () => {
  let tokenReads = 0;
  for (const path of ['https://untrusted.example/path', '//untrusted.example/path']) {
    await assert.rejects(api.apiRequest(path, async () => { tokenReads++; return 'secret-token'; }), /API-relative/);
  }
  assert.equal(tokenReads, 0);
});

test('username conflicts remain actionable without reflecting arbitrary server errors', async () => {
  globalThis.fetch = async () => Response.json({ code: 'USERNAME_TAKEN', message: 'private database details' }, { status: 409 });
  await assert.rejects(api.apiRequest('/users/me', async () => 'session-token', { method: 'POST', body: { username: 'fox', minimumAgeConfirmed: true } }), (error: unknown) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.code, 'USERNAME_TAKEN');
    assert.ok(api.requestErrorMessage(error).includes('Try another'));
    assert.ok(!error.message.includes('private database details'));
    return true;
  });
});

test('provider error details are replaced with safe, useful copy', () => {
  assert.ok(clerkErrorMessage({ errors: [{ code: 'form_code_incorrect', message: 'internal secret details' }] }).includes('code did not match'));
  assert.ok(!clerkErrorMessage(new Error('private token')).includes('private token'));
});

test('character selection retries an expired token with the same body and gives safe recovery copy', async () => {
  const bodies: (BodyInit | null | undefined)[] = [];
  globalThis.fetch = async (input, init) => {
    assert.equal(input.toString(), 'https://api.example.invalid/users/me/character');
    bodies.push(init?.body);
    if (bodies.length === 1) return Response.json({}, { status: 401 });
    return Response.json({ code: 'CHARACTER_UNAVAILABLE', message: 'private database details' }, { status: 404 });
  };
  await assert.rejects(api.apiRequest('/users/me/character', async () => 'session-token', { method: 'POST', body: { characterId: 'char_fox_lantern' } }), (error: unknown) => {
    assert.ok(api.requestErrorMessage(error).includes('choose another'));
    assert.ok(!api.requestErrorMessage(error).includes('private database'));
    return true;
  });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[0], bodies[1]);
  assert.deepEqual(JSON.parse(String(bodies[0])), { characterId: 'char_fox_lantern' });
});

test('an account change during token refresh cannot return the next account’s token', async () => {
  let current = 'sess_first';
  let resolveToken: (value: string) => void = () => { throw new Error('Token request was not started'); };
  const getToken = bindSessionToken(() => current, 'sess_first', () => new Promise<string>((resolve) => { resolveToken = resolve; }));
  const pending = getToken();
  current = 'sess_second';
  resolveToken('second-account-token');
  assert.equal(await pending, null);
});

test('an expired in-flight request is not retried as a different signed-in account', async () => {
  let current = 'sess_first';
  let requests = 0;
  const getToken = bindSessionToken(() => current, 'sess_first', async () => `${current}-token`);
  globalThis.fetch = async () => { requests++; current = 'sess_second'; return Response.json({}, { status: 401 }); };
  await assert.rejects(api.apiRequest('/users/me', getToken, { method: 'POST', body: { username: 'first_user', minimumAgeConfirmed: true } }), (error: unknown) => error instanceof api.ApiError && error.status === 401);
  assert.equal(requests, 1);
});
