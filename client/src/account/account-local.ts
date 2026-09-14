import { draftStorage } from '../letters/draft-storage';
import { CLOSED_ACCOUNT_PREFIX, closedAccountKey, privateKeyOwner } from './local-privacy';
import { eraseVoiceOwner } from '../voice/voice-storage';
import { backupStore } from '../backups/backup-storage';
import { eraseShareOwner } from '../letters/share-platform';
export function closeLocalAccount(ownerId: string) { if(draftStorage.read(closedAccountKey(ownerId))!=='closed')draftStorage.write(closedAccountKey(ownerId),'closed'); }
export async function erasePreviouslyClosedAccounts() {
  for(const key of draftStorage.cleanupKeys?.()??draftStorage.keys())if(key.startsWith(CLOSED_ACCOUNT_PREFIX))await eraseLocalAccount(decodeURIComponent(key.slice(CLOSED_ACCOUNT_PREFIX.length)));
}
export async function eraseLocalAccount(ownerId: string) {
  closeLocalAccount(ownerId);
  for (const key of draftStorage.cleanupKeys?.()??draftStorage.keys()) if (privateKeyOwner(key) === ownerId) draftStorage.remove!(key);
  await eraseVoiceOwner(ownerId); await backupStore.eraseOwner(ownerId); await eraseShareOwner(ownerId);
}
