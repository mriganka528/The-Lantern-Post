export const CLOSED_ACCOUNT_PREFIX = 'lantern-account-closed-v1-';
export const closedAccountKey = (ownerId: string) => CLOSED_ACCOUNT_PREFIX + encodeURIComponent(ownerId);
export function privateKeyOwner(key: string): string | null {
  for (const prefix of ['lantern-draft-v1-','lantern-letter-choice-v1-','lantern-events-v1-','lantern-alerts-v1-','lantern-bell-seen-v1-','lantern-daily-reminder-v1-']) if (key.startsWith(prefix)) return decodeURIComponent(key.slice(prefix.length));
  if (key.startsWith('lantern-letter-v1-')) { const suffix=key.slice('lantern-letter-v1-'.length); return decodeURIComponent(suffix.slice(0,suffix.lastIndexOf('--'))); }
  if (key.startsWith('lantern-chat-v1-')) {
    const pair: unknown = JSON.parse(decodeURIComponent(key.slice('lantern-chat-v1-'.length)));
    if (Array.isArray(pair) && pair.length === 2 && pair.every(v => typeof v === 'string')) return pair[0] as string;
  }
  return null;
}
export function assertPrivateWrite(key: string, read: (key: string) => string | null) {
  const owner = privateKeyOwner(key); if (owner && read(closedAccountKey(owner)) !== null) throw new Error('This account is closed on this device.');
}
