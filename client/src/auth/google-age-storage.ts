const KEY = 'lantern-post:pending-google-age';
const MAX_AGE_MS = 10 * 60 * 1000;
export interface GoogleAgeStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export function saveGoogleAge(storage: GoogleAgeStorage, now = Date.now()): void {
  // Tab-scoped UI state only: no birth date, email, user ID, or token is stored.
  storage.setItem(KEY, JSON.stringify({ confirmedAt: now }));
}

export function clearGoogleAge(storage: GoogleAgeStorage): void { storage.removeItem(KEY); }

export function consumeGoogleAge(storage: GoogleAgeStorage, now = Date.now()): boolean {
  const raw = storage.getItem(KEY);
  storage.removeItem(KEY);
  if (!raw) return false;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || !('confirmedAt' in value) || typeof value.confirmedAt !== 'number') return false;
    const age = now - value.confirmedAt;
    return Number.isFinite(age) && age >= 0 && age <= MAX_AGE_MS;
  } catch { return false; }
}
