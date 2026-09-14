import { isIP } from 'node:net';

function exactOrigin(value: string, name: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${name} must contain exact HTTP(S) origins.`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must contain exact HTTP(S) origins without credentials or paths.`);
  }
  return url;
}

function privateAddress(hostname: string): boolean {
  if (['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return true;
  if (isIP(hostname) !== 4) return false;
  const [a, b] = hostname.split('.').map(Number);
  return a === 10 || a === 172 && b! >= 16 && b! <= 31 || a === 192 && b === 168;
}

export function webOrigins(production: boolean, configured?: string, developmentOrigins?: string): string[] {
  const origins = (configured ?? (production ? '' : 'http://localhost:8081,http://127.0.0.1:8081'))
    .split(',').map(value => value.trim()).filter(Boolean).map(value => {
      const url = exactOrigin(value, 'WEB_ORIGINS');
      const localDevelopment = !production && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
      if (url.protocol === 'http:' && !localDevelopment) throw new Error('WEB_ORIGINS requires HTTPS origins, or HTTP loopback origins during development.');
      return url.origin;
    });
  // Explicit opt-in for trusted Expo browser origins and local native sockets.
  // Never infer these from request headers or allow arbitrary HTTP websites.
  const previews = (developmentOrigins ?? '').split(',').map(value => value.trim()).filter(Boolean).map(value => {
    const url = exactOrigin(value, 'DEVELOPMENT_WEB_ORIGINS');
    if (!privateAddress(url.hostname)) throw new Error('DEVELOPMENT_WEB_ORIGINS only accepts exact loopback or private IPv4 origins.');
    return url.origin;
  });
  return [...new Set([...origins, ...previews])];
}
