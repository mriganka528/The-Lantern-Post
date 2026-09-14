import { createHash, createHmac } from 'node:crypto';
export interface S3Settings { endpoint: string; bucket: string; region: string; accessKeyId: string; secretAccessKey: string; }
const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const hmac = (key: string | Buffer, value: string) => createHmac('sha256', key).update(value).digest();
// AWS Signature Version 4 query signing. Uploads sign Content-Length and
// Content-Type as well as Host; the browser supplies its actual body length.
export function signObjectUrl(settings: S3Settings, method: 'PUT' | 'GET' | 'DELETE' | 'HEAD', key: string, expiresSeconds: number, now = new Date(), headers: Record<string, string> = {}) {
  if (!/^voice\/(incoming|sealed)\/voice_[a-f0-9]{64}$/.test(key) || expiresSeconds < 1 || expiresSeconds > 900) throw new Error('Invalid object grant.');
  const endpoint = new URL(settings.endpoint);
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); const day = timestamp.slice(0, 8);
  const scope = `${day}/${settings.region}/s3/aws4_request`;
  const signed = Object.entries({ ...headers, host: endpoint.host }).map(([name, value]) => [name.toLowerCase(), value.trim().replace(/\s+/g, ' ')] as const).sort(([a], [b]) => a.localeCompare(b));
  const names = signed.map(([name]) => name).join(';');
  const canonicalHeaders = signed.map(([name, value]) => `${name}:${value}\n`).join('');
  const path = `/${encode(settings.bucket)}/${key.split('/').map(encode).join('/')}`;
  const query = Object.entries({ 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': `${settings.accessKeyId}/${scope}`, 'X-Amz-Date': timestamp, 'X-Amz-Expires': String(expiresSeconds), 'X-Amz-SignedHeaders': names }).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${encode(name)}=${encode(value)}`).join('&');
  const canonical = `${method}\n${path}\n${query}\n${canonicalHeaders}\n${names}\nUNSIGNED-PAYLOAD`;
  const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${sha(canonical)}`;
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${settings.secretAccessKey}`, day), settings.region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
  return `${endpoint.origin}${path}?${query}&X-Amz-Signature=${signature}`;
}
