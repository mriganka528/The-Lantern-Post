import { File } from 'expo-file-system';
import type { VoiceArchive } from './voice-backup-contract';
import type { PreparedShare } from '../letters/share-contract';
import { nativeShareFile } from '../letters/share-platform';
export async function prepareVoiceArchiveMedia(ownerId:string,archive:VoiceArchive):Promise<PreparedShare> {const file=await nativeShareFile(ownerId,archive.bytes,archive.voice.mimeType);return {files:[],nativeFiles:[file],previewUri:file.uri,ownerId,dispose:()=>{const stored=new File(file.uri);if(stored.exists)stored.delete();}};}
