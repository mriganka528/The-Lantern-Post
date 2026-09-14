import assert from 'node:assert/strict';
import { test } from 'node:test';

test('actual web and native environment modules default to Render without a local backend', async () => {
  const names = ['EXPO_PUBLIC_API_URL', 'EXPO_PUBLIC_WEB_API_URL', 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY'] as const;
  const previous = Object.fromEntries(names.map(name => [name, process.env[name]]));
  const dev = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');
  delete process.env.EXPO_PUBLIC_API_URL; delete process.env.EXPO_PUBLIC_WEB_API_URL;
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk';
  Object.defineProperty(globalThis, '__DEV__', { value: true, configurable: true });
  try {
    const native = await import('../src/config/env'); const web = await import('../src/config/env.web');
    assert.equal(native.env.apiUrl, 'https://the-lantern-post.onrender.com');
    assert.equal(web.env.apiUrl, native.env.apiUrl);
  } finally {
    for (const name of names) { if (previous[name] === undefined) delete process.env[name]; else process.env[name] = previous[name]; }
    if (dev) Object.defineProperty(globalThis, '__DEV__', dev); else Reflect.deleteProperty(globalThis, '__DEV__');
  }
});
