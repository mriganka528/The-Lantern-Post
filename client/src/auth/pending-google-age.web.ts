import { consumeGoogleAge } from './google-age-storage';

export function takePendingGoogleAge(): boolean {
  try { return consumeGoogleAge(window.sessionStorage); } catch { return false; }
}
