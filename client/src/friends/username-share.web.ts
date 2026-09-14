import { usernameCard } from './username-card-contract';
export const canCopyUsername = typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';
export async function copyUsername(username: string) { usernameCard(username); await navigator.clipboard.writeText('@' + username); }
export async function shareUsername(username: string): Promise<'shared' | 'cancelled' | 'copied'> {
  const card = usernameCard(username);
  if (typeof navigator.share !== 'function') { await navigator.clipboard.writeText(card.text); return 'copied'; }
  try { await navigator.share(card); return 'shared'; }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; throw error; }
}
