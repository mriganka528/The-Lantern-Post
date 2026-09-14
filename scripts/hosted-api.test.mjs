import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { checkHostedApi, deploymentOrigin } from './check-hosted-api.mjs';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const { WebSocketServer } = require('ws');

async function fixture(t, { ready = true, privateStatus = 401, sockets = true, allowOrigin = true, corsOrigin, stalledBody = false } = {}) {
  const requests = []; const probes = [];
  const server = createServer((request, response) => {
    requests.push({ method: request.method, path: request.url, auth: request.headers.authorization });
    if (request.method === 'OPTIONS') {
      response.statusCode = 204;
      if (request.headers.origin === corsOrigin) {
        response.setHeader('Access-Control-Allow-Origin', corsOrigin);
        response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      }
      response.end(); return;
    }
    response.setHeader('Content-Type', 'application/json');
    if (request.url === '/health') {
      if (stalledBody) { response.write('{'); return; }
      response.end(JSON.stringify({ status: 'ok', service: 'lantern-post-api' }));
    } else if (request.url === '/health/ready') {
      response.statusCode = ready ? 200 : 503;
      response.end(JSON.stringify({ status: ready ? 'ok' : 'error', checks: { database: ready ? 'up' : 'down' } }));
    } else if (request.url === '/users/me') { response.statusCode = privateStatus; response.end('{}'); }
    else { response.statusCode = 404; response.end('{}'); }
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    if (!sockets || request.headers.origin && !allowOrigin) { socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, client => {
      client.once('message', raw => {
        probes.push({ path: request.url, origin: request.headers.origin, data: JSON.parse(raw.toString()) });
        client.send(JSON.stringify({ type: 'error' })); client.close(4001, 'Reconnect');
      });
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => {
    wss.clients.forEach(client => client.terminate());
    await new Promise(resolve => wss.close(resolve));
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  return { url: `http://127.0.0.1:${server.address().port}`, requests, probes };
}
const options = { allowLocal: true, timeoutMs: 3000, socketTimeoutMs: 1000, report: () => {} };

test('deployment URLs require HTTPS and exclude embedded secrets and non-root paths', () => {
  assert.equal(deploymentOrigin('https://api.example.com/'), 'https://api.example.com');
  for (const value of [undefined, 'http://api.example.com', 'https://user:secret@api.example.com', 'https://api.example.com?token=secret', 'https://api.example.com#secret', 'https://api.example.com/path', 'http://localhost:3000']) {
    assert.throws(() => deploymentOrigin(value), error => !error.message.includes('secret'));
  }
  assert.equal(deploymentOrigin('http://127.0.0.1:3000', true), 'http://127.0.0.1:3000');
  assert.throws(() => deploymentOrigin('http://api.example.com', true));
});

test('deployment checks use only public GETs and invalid, content-free socket probes', async t => {
  const api = await fixture(t); const reports = [];
  await checkHostedApi(api.url, { ...options, report: message => reports.push(message) });
  assert.deepEqual(api.requests, ['/health', '/health/ready', '/users/me'].map(path => ({ method: 'GET', path, auth: undefined })));
  assert.deepEqual(api.probes, ['/chat/socket', '/events/socket'].map(path => ({ path, origin: api.url, data: { type: 'deployment-probe' } })));
  assert.equal(reports.filter(message => message.startsWith('PASS:')).length, 5);
});

test('an HTTP-only host fails instead of claiming real-time transport is ready', async t => {
  const api = await fixture(t, { sockets: false });
  await assert.rejects(checkHostedApi(api.url, options), /WebSocket/);
});

test('deployment checks detect when the Android WebSocket origin is not allowed', async t => {
  const api = await fixture(t, { allowOrigin: false });
  await assert.rejects(checkHostedApi(api.url, options), /WEB_ORIGINS/);
});

test('database readiness failure stops before private routes or sockets', async t => {
  const api = await fixture(t, { ready: false });
  await assert.rejects(checkHostedApi(api.url, options), /Database readiness/);
  assert.equal(api.requests.length, 2); assert.equal(api.probes.length, 0);
});

test('an unprotected account endpoint never passes the deployment check', async t => {
  const api = await fixture(t, { privateStatus: 200 });
  await assert.rejects(checkHostedApi(api.url, options), /must reject/);
  assert.equal(api.probes.length, 0);
});

test('the request deadline includes a response body that never finishes', async t => {
  const api = await fixture(t, { stalledBody: true });
  await assert.rejects(checkHostedApi(api.url, { ...options, timeoutMs: 150 }));
  assert.equal(api.requests.length, 1); assert.equal(api.probes.length, 0);
});

test('optional browser checks verify both CORS and socket origins without authentication', async t => {
  const origin = 'http://localhost:8081'; const api = await fixture(t, { corsOrigin: origin });
  await checkHostedApi(api.url, { ...options, webOrigin: origin });
  assert.equal(api.requests.at(-1).method, 'OPTIONS');
  assert.ok(api.requests.every(request => request.auth === undefined));
  assert.deepEqual(api.probes.slice(2).map(probe => probe.origin), [origin, origin]);
});

test('missing browser CORS configuration fails despite healthy native sockets', async t => {
  const api = await fixture(t);
  await assert.rejects(checkHostedApi(api.url, { ...options, webOrigin: 'http://localhost:8081' }), /DEVELOPMENT_WEB_ORIGINS/);
  assert.equal(api.probes.length, 2);
});
