import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import WebSocket from 'ws';
import { createFriendsTestApp } from './friends-fixture';

let context: Awaited<ReturnType<typeof createFriendsTestApp>>;
before(async () => {
  context = await createFriendsTestApp(false, undefined, undefined, 'disabled', {
    NODE_ENV: 'production', WEB_ORIGINS: 'https://api.example.com',
    DEVELOPMENT_WEB_ORIGINS: 'http://localhost:8081,http://192.168.29.181:3000',
    CLERK_PUBLISHABLE_KEY: `pk_test_${Buffer.from('test.clerk.accounts.dev$').toString('base64')}`,
    CLERK_SECRET_KEY: 'sk_test_fixture',
  });
});
after(async () => { await context?.app.close(); });

async function socketOpens(path: string, origin: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(context.url.replace('http:', 'ws:') + path, { origin });
    let settled = false;
    const finish = (opened: boolean) => {
      if (settled) return; settled = true; clearTimeout(timer); socket.terminate(); resolve(opened);
    };
    const timer = setTimeout(() => { settled = true; socket.terminate(); reject(Error('Socket origin check timed out')); }, 3000);
    socket.on('open', () => finish(true)); socket.on('error', () => finish(false)); socket.on('close', () => finish(false));
  });
}

test('production chat and arrival sockets accept only configured hosted and local origins', async () => {
  for (const path of ['/chat/socket', '/events/socket']) {
    for (const origin of ['https://api.example.com', 'http://localhost:8081', 'http://192.168.29.181:3000']) {
      assert.equal(await socketOpens(path, origin), true);
    }
    for (const origin of ['http://localhost:8082', 'http://localhost.evil.example:8081', 'https://untrusted.example']) {
      assert.equal(await socketOpens(path, origin), false);
    }
  }
});
