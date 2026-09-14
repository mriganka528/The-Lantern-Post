import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import { MAX_ARCHIVE_BYTES, readArchive } from './backup-contract';
import type { BackupArchive,BackupConversation,BackupMessage } from './backup-contract';
export interface BackupManifest { ownerKey:string; conversations:{peerId:string;username:string;through:number}[]; }
export async function collectArchive(token:GetSessionToken,signal:AbortSignal):Promise<BackupArchive> {
  const manifest=await apiRequest<BackupManifest>('/backups/manifest',token,{signal});const conversations:BackupConversation[]=[];let count=0;let bytes=0;
  if(manifest.conversations.length>500)throw Error('Archive too large.');
  for(const peer of manifest.conversations) {
    let before:number|null=2147483647;const messages:BackupMessage[]=[];
    while(before!==null) {
      const page:{messages:BackupMessage[];before:number|null}=await apiRequest<{messages:BackupMessage[];before:number|null}>(`/backups/page?peerId=${encodeURIComponent(peer.peerId)}&through=${peer.through}&before=${before}`,token,{signal});
      if(page.before!==null && (page.before>=before || page.before<1))throw Error('Invalid backup page.');
      count+=page.messages.length;bytes+=new TextEncoder().encode(JSON.stringify(page.messages)).length;if(count>10000 || bytes>MAX_ARCHIVE_BYTES)throw Error('This archive exceeds the current 10,000-message limit.');
      messages.push(...page.messages);before=page.before;
    }
    conversations.push({...peer,messages:messages.reverse()});
  }
  const current=await apiRequest<BackupManifest>('/backups/manifest',token,{signal});
  if(current.ownerKey!==manifest.ownerKey || conversations.some(c=>!current.conversations.some(p=>p.peerId===c.peerId)))throw Error('A friendship changed. Please make a fresh backup.');
  return readArchive({version:1,ownerKey:manifest.ownerKey,createdAt:new Date().toISOString(),conversations},manifest.ownerKey);
}
