// Content-free deployment check. No credentials, account data or sends required.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../server/package.json', import.meta.url));
const WebSocket = require('ws');

export function deploymentOrigin(value, allowLocal = false) {
  let url;
  try { url = new URL(value); } catch { throw Error('Supply --url=https://YOUR-API-HOST with no credentials or path.'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !(url.protocol === 'https:' || allowLocal && local && url.protocol === 'http:') ||
      local && !allowLocal) {
    throw Error('Use a public HTTPS origin. HTTP loopback is allowed only with --allow-local for local checks.');
  }
  return url.origin;
}

async function get(origin, path, timeoutMs) {
  const response = await fetch(origin + path, { redirect: 'error', signal: AbortSignal.timeout(timeoutMs) });
  const reader = response.body?.getReader();
  const chunks = []; let length = 0;
  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 16384) throw Error('The API check returned an unexpected response size.');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); }
  }
  return { status: response.status, body: Buffer.concat(chunks).toString('utf8') };
}

async function socketCheck(origin, path, timeoutMs, requestOrigin = origin) {
  const url = new URL(origin); url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'; url.pathname = path;
  await new Promise((resolveCheck, reject) => {
    // React Native Android supplies this HTTP(S) Origin by default. Checking
    // without it could pass while every real Android subscription is rejected.
    const socket = new WebSocket(url, { origin: requestOrigin, handshakeTimeout: timeoutMs, maxPayload: 16384, perMessageDeflate: false });
    let done = false; let rejectedProbe = false;
    const finish = error => {
      if (done) return;
      done = true; clearTimeout(timer); socket.terminate();
      if (error) reject(error); else resolveCheck();
    };
    const timer = setTimeout(() => finish(Error('WebSocket check timed out.')), timeoutMs);
    // Deliberately invalid schema: verifies upgrade and rejection before account
    // lookup/authentication, without subscribing to or modifying any real data.
    socket.on('open', () => socket.send(JSON.stringify({ type: 'deployment-probe' })));
    socket.on('message', data => {
      try { rejectedProbe = JSON.parse(data.toString()).type === 'error'; }
      catch { finish(Error('Unexpected WebSocket response.')); }
    });
    socket.on('close', code => finish(code === 4001 && rejectedProbe ? undefined : Error('WebSocket did not reject the invalid subscription as expected.')));
    socket.on('error', () => finish(Error('WebSocket upgrade or connection failed. Check that WEB_ORIGINS includes the exact API HTTPS origin.')));
  });
}

export async function checkHostedApi(value, { allowLocal = false, webOrigin, timeoutMs = 60000, socketTimeoutMs = 10000, report = console.log } = {}) {
  const origin = deploymentOrigin(value, allowLocal);
  let browser;
  if (webOrigin) {
    try { browser = new URL(webOrigin); } catch { throw Error('Browser origin must be an exact HTTP(S) origin.'); }
    if (!['http:', 'https:'].includes(browser.protocol) || browser.username || browser.password || browser.pathname !== '/' || browser.search || browser.hash) throw Error('Browser origin must be an exact HTTP(S) origin.');
  }
  let result = await get(origin, '/health', timeoutMs);
  let health;
  try { health = JSON.parse(result.body); } catch { throw Error('Liveness did not return API JSON.'); }
  if (result.status !== 200 || health.status !== 'ok' || health.service !== 'lantern-post-api') throw Error('API liveness failed.');
  report('PASS: API liveness');
  result = await get(origin, '/health/ready', timeoutMs);
  let ready;
  try { ready = JSON.parse(result.body); } catch { throw Error('Readiness did not return API JSON.'); }
  if (result.status !== 200 || ready.status !== 'ok' || ready.checks?.database !== 'up') throw Error('Database readiness failed. Check hosted database settings.');
  report('PASS: Database readiness');
  result = await get(origin, '/users/me', timeoutMs);
  if (result.status !== 401) throw Error('The private account route must reject requests without a session.');
  report('PASS: Private account route rejects missing authentication');
  for (const path of ['/chat/socket', '/events/socket']) {
    await socketCheck(origin, path, socketTimeoutMs);
    report(`PASS: ${path} upgrades and rejects invalid subscriptions`);
  }
  if (browser) {
    const response = await fetch(origin + '/users/me', {
      method: 'OPTIONS', redirect: 'error', signal: AbortSignal.timeout(timeoutMs),
      headers: { Origin: browser.origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,content-type' },
    });
    await response.body?.cancel();
    const headers = response.headers;
    if (!response.ok || headers.get('access-control-allow-origin') !== browser.origin ||
        !/authorization/i.test(headers.get('access-control-allow-headers') || '') ||
        !/content-type/i.test(headers.get('access-control-allow-headers') || '') ||
        headers.get('access-control-allow-credentials') === 'true') {
      throw Error('Browser origin is not allowed. Check DEVELOPMENT_WEB_ORIGINS on the deployed server.');
    }
    report('PASS: Browser preflight allows the configured origin and bearer header without cookies');
    for (const path of ['/chat/socket', '/events/socket']) {
      await socketCheck(origin, path, socketTimeoutMs, browser.origin);
      report(`PASS: Browser origin accepted by ${path}`);
    }
  }
  report('Deployment transport checks passed. Real sign-in, chat delivery and voice playback still need a targeted app check.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const value = process.argv.find(arg => arg.startsWith('--url='))?.slice(6);
  const webOrigin = process.argv.find(arg => arg.startsWith('--web-origin='))?.slice(13);
  try { await checkHostedApi(value, { allowLocal: process.argv.includes('--allow-local'), webOrigin }); }
  catch (error) {
    // Do not print remote response bodies, headers, URLs, errors or stack traces.
    const known = /^(Supply |Use a public |API liveness|Database readiness|The private account|Liveness did not|Readiness did not|WebSocket |Unexpected WebSocket|The API check|Browser origin)/;
    console.error(error instanceof Error && known.test(error.message) ? error.message : 'API check failed or timed out. Check the hostname, service logs and network, then retry once the service is awake.');
    process.exitCode = 1;
  }
}
