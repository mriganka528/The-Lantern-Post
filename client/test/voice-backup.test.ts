import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packVoiceArchive,unpackVoiceArchive } from '../src/backups/voice-backup-contract';
const ownerKey='a'.repeat(64);
const archive=()=>({version:1 as const,ownerKey,createdAt:new Date().toISOString(),voice:{mimeType:'audio/webm' as const,byteLength:128,durationMs:2000},caption:'An explicitly included caption.',preset:null,bytes:new Uint8Array(128).map((_,i)=>i)});
test('voice backup packs exact audio bytes and restores only to the original account',()=>{
  const original=archive();const packed=packVoiceArchive(original);assert.deepEqual(unpackVoiceArchive(packed,ownerKey),original);assert.throws(()=>unpackVoiceArchive(packed,'b'.repeat(64)));assert.throws(()=>unpackVoiceArchive(packed.subarray(0,packed.length-1),ownerKey));
});
test('voice backup rejects oversized headers, mismatched lengths and unsupported recording metadata',()=>{
  const bad=packVoiceArchive(archive());new DataView(bad.buffer).setUint32(0,999999);assert.throws(()=>unpackVoiceArchive(bad,ownerKey));assert.throws(()=>packVoiceArchive({...archive(),voice:{...archive().voice,durationMs:999999}}));assert.throws(()=>packVoiceArchive({...archive(),bytes:new Uint8Array(64)}));
});
