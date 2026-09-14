import { CryptoDigestAlgorithm,digestStringAsync } from 'expo-crypto';
import { draftStorage } from '../letters/draft-storage';
import { decodeDraft,draftKey } from '../letters/draft';
import { LetterLibrary,letterDocumentId } from '../letters/letter-library';
import { voiceStorage } from '../voice/voice-storage';
import { assertAccountOpen } from '../account/account-fence';
import { encryptBackupBytes,decryptBackupBytes } from './backup-crypto';
import { packVoiceArchive,unpackVoiceArchive } from './voice-backup-contract';
export const voiceBackupOwnerKey=(ownerId:string)=>digestStringAsync(CryptoDigestAlgorithm.SHA256,'lantern-backup-owner\0'+ownerId);
export function voiceBackupChoices(ownerId:string) {
  const library=new LetterLibrary(ownerId,draftStorage,()=>{throw Error('Reading only.');});return library.entries().flatMap(entry=>{if(entry.stage!=='writing'&&entry.stage!=='sealed')return [];const key=draftKey(ownerId,letterDocumentId(entry.id));const draft=decodeDraft(draftStorage.read(key),ownerId);return draft.kind==='VOICE'&&draft.voice&&!draft.voiceDeletes.length?[{key,updatedAt:draft.updatedAt,hasCaption:Boolean(draft.voiceCaption)}]:[];});
}
export async function prepareVoiceBackup(ownerId:string,key:string,includeCaption:boolean) {
  assertAccountOpen(ownerId);if(!voiceBackupChoices(ownerId).some(item=>item.key===key))throw Error('This recording is not available for backup.');const revision=draftStorage.read(key);const draft=decodeDraft(revision,ownerId);if(!draft.voice||draft.kind!=='VOICE'||draft.voiceDeletes.length||!['writing','sealed'].includes(draft.stage))throw Error('This recording changed.');
  const bytes=await voiceStorage.read(ownerId,draft.voice);const packed=packVoiceArchive({version:1,ownerKey:await voiceBackupOwnerKey(ownerId),createdAt:new Date().toISOString(),voice:draft.voice,caption:includeCaption?draft.voiceCaption:'',preset:draft.preset,bytes});
  const result=await encryptBackupBytes('lantern-voice-backup',packed);assertAccountOpen(ownerId);if(draftStorage.read(key)!==revision)throw Error('This recording changed while its backup was prepared.');return {...result,source:{key,revision}};
}
export async function openVoiceBackup(envelope:unknown,key:string,ownerId:string) {assertAccountOpen(ownerId);const bytes=await decryptBackupBytes(envelope,key,'lantern-voice-backup');const result=unpackVoiceArchive(bytes,await voiceBackupOwnerKey(ownerId));assertAccountOpen(ownerId);return result;}
