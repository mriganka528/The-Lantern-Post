import { Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Directory, File, Paths } from 'expo-file-system';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import type { PreparedShare, ShareCopy, ShareResult } from './share-contract';
import { voiceStorage } from '../voice/voice-storage';
import { assertAccountOpen } from '../account/account-fence';
export const fileSharingAvailable = true;
export const fileSharingNote = 'Illustrated pages and recordings open your phone’s share sheet. For a long letter, share each page separately.';
export const supportsDownload = false;
async function directory(ownerId:string) { if(!/^[a-zA-Z0-9_-]{1,100}$/.test(ownerId)) throw Error();return new Directory(Paths.cache,'lantern-exports',await digestStringAsync(CryptoDigestAlgorithm.SHA256,'lantern-export-scope:'+ownerId)); }
export async function eraseShareOwner(ownerId:string) {const d=await directory(ownerId);if(d.exists) d.delete();}
export async function nativeShareFile(ownerId:string,bytes:Uint8Array,mimeType:string) {
  assertAccountOpen(ownerId);const d=await directory(ownerId);assertAccountOpen(ownerId);d.create({idempotent:true,intermediates:true});const f=new File(d,randomUUID()+(mimeType==='image/png'?'.png':mimeType==='audio/webm'?'.webm':'.m4a'));f.write(bytes);return {uri:f.uri,mimeType};
}
export async function prepareShare(copy:ShareCopy,ownerId:string):Promise<PreparedShare|null> {
  if(copy.kind==='TEXT') return null;
  const bytes=await voiceStorage.read(ownerId,copy.voice);const file=await nativeShareFile(ownerId,bytes,copy.voice.mimeType);
  return {files:[],nativeFiles:[file],ownerId,dispose:()=>{const f=new File(file.uri);if(f.exists) f.delete();}};
}
export function canShareFiles(prepared:PreparedShare) {return Boolean(prepared.nativeFiles?.length);}
export async function shareFiles(prepared:PreparedShare,index=0):Promise<ShareResult> {
  if(!prepared.ownerId) throw Error();assertAccountOpen(prepared.ownerId);const file=prepared.nativeFiles?.[index];if(!file || !await Sharing.isAvailableAsync()) throw Error('Sharing unavailable.');assertAccountOpen(prepared.ownerId);
  await Sharing.shareAsync(file.uri,{mimeType:file.mimeType,UTI:file.mimeType==='image/png'?'public.png':file.mimeType==='audio/mp4'?'public.mpeg-4-audio':'org.webmproject.webm',dialogTitle:'A letter from Lantern Post'});return 'shared';
}
export function downloadShare(_prepared:PreparedShare) {throw Error('Use the share sheet to save this copy.');}
export async function shareWords(text: string): Promise<ShareResult> {
  const result = await Share.share({ title: 'A letter from Lantern Post', message: text });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
export const wordsAction: string = 'Share written words';
