export interface BackupMessage { sequence: number; side: 'mine' | 'theirs'; text: string; createdAt: string; }
export interface BackupConversation { peerId: string; username: string; through: number; messages: BackupMessage[]; }
export interface BackupArchive { version: 1; ownerKey: string; createdAt: string; conversations: BackupConversation[]; }
export interface EncryptedBackup { format: 'lantern-chat-backup'|'lantern-voice-backup'; version: 1; algorithm: 'AES-256-GCM'; data: string; }
export const MAX_ARCHIVE_BYTES = 10 * 1024 * 1024;
export function readEnvelope(value: unknown): EncryptedBackup {
  if (!value || typeof value !== 'object') throw Error('Invalid backup.'); const e = value as Record<string,unknown>;
  if (Object.keys(e).sort().join(',') !== 'algorithm,data,format,version' || !['lantern-chat-backup','lantern-voice-backup'].includes(String(e.format)) || e.version !== 1 || e.algorithm !== 'AES-256-GCM' || typeof e.data !== 'string' || e.data.length < 40 || e.data.length > 14 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(e.data)) throw Error('Invalid backup.');
  return e as unknown as EncryptedBackup;
}
export function readArchive(value: unknown, ownerKey: string): BackupArchive {
  if (!value || typeof value !== 'object') throw Error('Invalid archive.'); const a = value as BackupArchive;
  if (a.version !== 1 || a.ownerKey !== ownerKey || typeof a.createdAt !== 'string' || !Number.isFinite(Date.parse(a.createdAt)) || !Array.isArray(a.conversations) || a.conversations.length > 500) throw Error('This backup belongs to another account or is invalid.');
  let count = 0; const peers = new Set<string>();
  const conversations = a.conversations.map(c => {
    if (!c || typeof c.peerId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(c.peerId) || peers.has(c.peerId) || typeof c.username !== 'string' || c.username.length > 100 || !Number.isSafeInteger(c.through) || c.through < 0 || !Array.isArray(c.messages)) throw Error('Invalid conversation.');
    peers.add(c.peerId); let last = 0;
    const messages = c.messages.map(m => {
      if (++count > 10000 || !m || !Number.isSafeInteger(m.sequence) || m.sequence <= last || m.sequence > c.through || !['mine','theirs'].includes(m.side) || typeof m.text !== 'string' || !m.text.trim() || Array.from(m.text).length > 2000 || typeof m.createdAt !== 'string' || !Number.isFinite(Date.parse(m.createdAt))) throw Error('Invalid message.');
      last = m.sequence; return { sequence: m.sequence,side: m.side,text: m.text,createdAt: m.createdAt };
    }); return { peerId:c.peerId,username:c.username,through:c.through,messages };
  });
  return { version:1,ownerKey,createdAt:a.createdAt,conversations };
}
