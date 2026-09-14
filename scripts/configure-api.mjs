// Explicit development switch. Never probes hosts or replays a failed request.
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { parse } = require('dotenv');
export const HOSTED_API = 'https://the-lantern-post.onrender.com';

function apiOrigin(value, local) {
  let url;
  try { url = new URL(value); } catch { throw Error('Supply an API HTTP(S) origin.'); }
  const [a, b] = url.hostname.split('.').map(Number);
  const privateHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || isIP(url.hostname) === 4 && (a === 10 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168);
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      !['http:', 'https:'].includes(url.protocol) || (local ? !privateHost : url.protocol !== 'https:')) {
    throw Error(local ? 'Local API URLs must be exact loopback or private IP origins without credentials or paths.' : 'Hosted API URLs must use HTTPS without credentials or paths.');
  }
  return url.origin;
}

export function replaceEnvValues(source, values) {
  const newline = source.includes('\r\n') ? '\r\n' : '\n';
  const found = new Set();
  const lines = source.split(/\r?\n/).map(line => {
    const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (!match || !Object.hasOwn(values, match[1])) return line;
    found.add(match[1]); return `${match[1]}=${values[match[1]]}`;
  });
  while (lines.at(-1) === '') lines.pop();
  for (const [key, value] of Object.entries(values)) if (!found.has(key)) lines.push(`${key}=${value}`);
  return lines.join(newline) + newline;
}

function writeSettings(path, values) {
  const source = readFileSync(path, 'utf8');
  const next = replaceEnvValues(source, values);
  if (next === source) return;
  const temporary = `${path}.api-${randomUUID()}.tmp`;
  try { writeFileSync(temporary, next, { flag: 'wx', mode: 0o600 }); renameSync(temporary, path); }
  finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

export function configureApi({ mode, url, webUrl, root = fileURLToPath(new URL('../', import.meta.url)) }) {
  if (!['hosted', 'local'].includes(mode)) throw Error('Choose hosted or local mode.');
  const local = mode === 'local';
  const native = apiOrigin(url || (local ? 'http://localhost:3000' : HOSTED_API), local);
  const web = apiOrigin(webUrl || native, local);
  const clientFile = resolve(root, 'client/.env');
  if (!existsSync(clientFile)) throw Error('Run npm run setup:env before choosing the API.');
  if (local) {
    const serverFile = resolve(root, 'server/.env');
    if (existsSync(serverFile)) {
      const current = parse(readFileSync(serverFile, 'utf8')).DEVELOPMENT_WEB_ORIGINS || '';
      const previews = [native, web].map(value => { const origin = new URL(value); origin.port = '8081'; return origin.origin; });
      const origins = [...new Set([...current.split(',').map(value => value.trim()).filter(Boolean), 'http://localhost:8081', 'http://127.0.0.1:8081', native, web, ...previews])];
      writeSettings(serverFile, { DEVELOPMENT_WEB_ORIGINS: origins.join(',') });
    }
  }
  writeSettings(clientFile, { EXPO_PUBLIC_API_URL: native, EXPO_PUBLIC_WEB_API_URL: web });
  return { native, web, local };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const selected = configureApi({ mode: process.argv[2], url: argument('url'), webUrl: argument('web-url') });
  console.log(`Native API: ${selected.native}\nBrowser API: ${selected.web}`);
  console.log(selected.local
    ? 'Local mode selected. Start npm run dev:server, then restart Expo. For a physical phone, use --url=http://YOUR_PC_LAN_IP:3000.'
    : 'Hosted mode selected. Restart Expo; no local API process is needed.');
  console.log('Sign-in credentials, drafts and pending operations were not changed.');
}
