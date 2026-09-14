import type { LetterPreset,VoiceClip } from '@lantern-post/shared-types';
import { cleanPreset } from '../letters/draft';
import { cleanVoiceClip,MAX_VOICE_BYTES } from '../voice/voice-contract';
export interface VoiceArchive {version:1;ownerKey:string;createdAt:string;voice:Omit<VoiceClip,'id'>;caption:string;preset:LetterPreset|null;bytes:Uint8Array;}
function metadata(value:unknown,ownerKey:string):Omit<VoiceArchive,'bytes'> {
  if(!value||typeof value!=='object')throw Error('Invalid voice backup.');const m=value as VoiceArchive;
  if(m.version!==1||m.ownerKey!==ownerKey||!/^[a-f0-9]{64}$/.test(ownerKey)||typeof m.createdAt!=='string'||!Number.isFinite(Date.parse(m.createdAt))||typeof m.caption!=='string'||Array.from(m.caption).length>2000)throw Error('This voice backup does not belong to this account or is invalid.');
  const voice=cleanVoiceClip({...m.voice,id:'00000000-0000-4000-8000-000000000001'});const preset=m.preset===null?null:cleanPreset(m.preset);if(!voice||m.preset!==null&&!preset)throw Error('Invalid recording metadata.');
  return {version:1,ownerKey,createdAt:m.createdAt,voice:{mimeType:voice.mimeType,byteLength:voice.byteLength,durationMs:voice.durationMs},caption:m.caption,preset};
}
export function packVoiceArchive(archive:VoiceArchive) {
  const m=metadata(archive,archive.ownerKey);if(archive.bytes.length!==m.voice.byteLength)throw Error('Recording length mismatch.');const header=new TextEncoder().encode(JSON.stringify(m));if(header.length>16384)throw Error('Recording metadata too large.');
  const bytes=new Uint8Array(4+header.length+archive.bytes.length);new DataView(bytes.buffer).setUint32(0,header.length);bytes.set(header,4);bytes.set(archive.bytes,4+header.length);return bytes;
}
export function unpackVoiceArchive(bytes:Uint8Array,ownerKey:string):VoiceArchive {
  if(bytes.length<68||bytes.length>MAX_VOICE_BYTES+16388)throw Error('Invalid voice backup length.');const length=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(0);if(length<2||length>16384||4+length>=bytes.length)throw Error('Invalid voice backup header.');
  const m=metadata(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(4,4+length))),ownerKey);const recording=bytes.slice(4+length);if(recording.length!==m.voice.byteLength)throw Error('Incomplete recording backup.');return {...m,bytes:recording};
}
