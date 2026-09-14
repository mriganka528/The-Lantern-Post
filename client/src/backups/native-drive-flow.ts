export const DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
export interface NativeDriveLink { id: string; state: string; webClientId: string; scopes: string[]; expiresAt: string; }
export interface NativeDriveTransport {
  begin(signal: AbortSignal): Promise<NativeDriveLink>;
  complete(link: NativeDriveLink, code: string, signal: AbortSignal): Promise<{ connected: boolean }>;
  cancel(link: NativeDriveLink, signal: AbortSignal): Promise<unknown>;
}
export interface NativeDrivePicker {
  authorize(link: NativeDriveLink, signal: AbortSignal): Promise<string | null>;
  foreground(signal: AbortSignal): Promise<boolean>;
}

function active(signal: AbortSignal) { if (signal.aborted) throw Error('Google connection cancelled.'); }
function validateLink(link: NativeDriveLink) {
  if (!link || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(link.id) ||
      !/^[A-Za-z0-9_-]{43}$/.test(link.state) || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(link.webClientId) ||
      !Array.isArray(link.scopes) || link.scopes.length !== 1 || link.scopes[0] !== DRIVE_APPDATA_SCOPE ||
      typeof link.expiresAt !== 'string' || !Number.isFinite(Date.parse(link.expiresAt))) {
    throw Error('Google connection is unavailable.');
  }
}

// One explicit connection attempt only. The Google grant is never persisted or
// retried automatically; a network failure can be resolved by refreshing status.
export async function connectNativeDrive(transport: NativeDriveTransport, picker: NativeDrivePicker, signal: AbortSignal): Promise<boolean> {
  active(signal);
  const link = await transport.begin(signal); active(signal); validateLink(link);
  let code: string | null = null;
  try {
    code = await picker.authorize(link, signal); active(signal);
    const foreground = await picker.foreground(signal); active(signal);
    if (!foreground) throw Error('Google connection was interrupted.');
    if (code === null) { await transport.cancel(link, signal); return false; }
    if (typeof code !== 'string' || !code || code.length > 4096) throw Error('Google connection did not return a usable grant.');
    const result = await transport.complete(link, code, signal); active(signal);
    if (!result.connected) throw Error('Google connection was not completed.');
    return true;
  } finally { code = null; }
}
