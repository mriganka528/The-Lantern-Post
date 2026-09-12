import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const portProbe = createServer();
portProbe.listen(0, '127.0.0.1');
await once(portProbe, 'listening');
const { port } = portProbe.address();
await new Promise((resolve, reject) => portProbe.close((error) => error ? reject(error) : resolve()));
const baseUrl = `http://127.0.0.1:${port}`;
const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
  env: { ...process.env, NODE_ENV: 'test', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let logs = '';
api.stdout.on('data', (chunk) => { logs += chunk; });
api.stderr.on('data', (chunk) => { logs += chunk; });
let spawnError;
api.on('error', (error) => { spawnError = error; });

try {
  let healthy = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (spawnError) throw spawnError;
    if (api.exitCode !== null || api.signalCode !== null) throw new Error(`API exited during startup.\n${logs}`);
    try {
      const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok && logs.includes(`Lantern Post API listening on port ${port}`)) {
        assert.deepEqual(await response.json(), { status: 'ok', service: 'lantern-post-api' });
        healthy = true;
        break;
      }
    } catch { /* Wait for the new process to listen. */ }
    await delay(250);
  }
  assert.ok(healthy, `API did not become healthy.\n${logs}`);

  const ready = await fetch(`${baseUrl}/health/ready`, { signal: AbortSignal.timeout(15000) });
  assert.equal(ready.status, 200, 'Database is not ready. Check server/.env DATABASE_URL and run npm run db:deploy.');
  assert.deepEqual(await ready.json(), { status: 'ok', service: 'lantern-post-api', checks: { database: 'up' } });

  const response = await fetch(`${baseUrl}/docs-json`, { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.ok(document.paths['/health']);
  assert.ok(document.paths['/health/ready']);
  console.log('API bootstrap, HTTP health, PostgreSQL readiness, and OpenAPI smoke checks passed.');
} finally {
  if (api.exitCode === null && api.signalCode === null && !spawnError) {
    const exited = once(api, 'exit');
    api.kill();
    await exited;
  }
}
