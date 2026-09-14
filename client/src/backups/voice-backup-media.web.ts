import type { VoiceArchive } from './voice-backup-contract';
import type { PreparedShare } from '../letters/share-contract';
import { assertAccountOpen } from '../account/account-fence';
export async function prepareVoiceArchiveMedia(ownerId:string,archive:VoiceArchive):Promise<PreparedShare> {assertAccountOpen(ownerId);const file=new File([new Uint8Array(archive.bytes).buffer],'lantern-recording.'+(archive.voice.mimeType==='audio/webm'?'webm':'m4a'),{type:archive.voice.mimeType});const uri=URL.createObjectURL(file);return {files:[file],previewUri:uri,ownerId,dispose:()=>URL.revokeObjectURL(uri)};}
