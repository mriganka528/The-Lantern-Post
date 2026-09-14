export interface DriveSettings { clientId: string; clientSecret: string; redirectUri: string; tokenKey: Buffer; }
export function driveSettings(input: Record<string, unknown>, production: boolean): DriveSettings | undefined {
  const values = ['GOOGLE_DRIVE_CLIENT_ID','GOOGLE_DRIVE_CLIENT_SECRET','GOOGLE_DRIVE_REDIRECT_URI','GOOGLE_DRIVE_TOKEN_KEY'].map(key => typeof input[key] === 'string' ? String(input[key]).trim() : '');
  if (!values.some(Boolean)) return undefined;
  if (values.some(value => !value)) throw Error('Configure all GOOGLE_DRIVE settings, or leave them empty.');
  const [clientId, clientSecret, redirectUri, key] = values as [string,string,string,string];
  let url: URL;
  try { url = new URL(redirectUri); } catch { throw Error('Google Drive requires a valid registered callback URL.'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/backups/drive/callback' || url.protocol !== 'https:' && (production || url.protocol !== 'http:' || !['localhost','127.0.0.1'].includes(url.hostname))) throw Error('Google Drive requires a registered HTTPS callback, or localhost HTTP in development.');
  const tokenKey = Buffer.from(key, 'base64'); if (tokenKey.length !== 32 || tokenKey.toString('base64') !== key) throw Error('GOOGLE_DRIVE_TOKEN_KEY must be a base64-encoded 32-byte key.');
  return { clientId, clientSecret, redirectUri, tokenKey };
}
