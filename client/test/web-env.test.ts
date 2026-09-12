import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clientEnvironment } from '../src/config/environment';

const key = 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk';

test('web and native builds select independent API addresses', async () => {
  const names = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_WEB_API_URL', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'] as const;
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  const dev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
  process.env.EXPO_PUBLIC_API_URL = 'http://10.0.2.2:3000';
  process.env.EXPO_PUBLIC_WEB_API_URL = 'http://localhost:3000';
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = key;
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  try {
    const native = await import('../src/config/env');
    const web = await import('../src/config/env.web');
    assert.equal(native.env.apiUrl, 'http://10.0.2.2:3000');
    assert.equal(web.env.apiUrl, 'http://localhost:3000');
    const browserCache = await import('../src/auth/token-cache.web');
    assert.equal(browserCache.tokenCache, undefined);
  } finally {
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
    if (dev) Object.defineProperty(globalThis, '__DEV__', dev); else Reflect.deleteProperty(globalThis, '__DEV__');
  }
});

test('release web API settings require HTTPS and cannot embed credentials', () => {
  const make = (apiUrl: string) => clientEnvironment({ apiUrl, clerkPublishableKey: key, development: false, apiVariable: 'EXPO_PUBLIC_WEB_API_URL' });
  assert.throws(() => make('http://localhost:3000'), /HTTPS/);
  assert.throws(() => make('https://user:secret@api.example.com'), /without credentials/);
  assert.equal(make('https://api.example.com/').apiUrl, 'https://api.example.com');
});
