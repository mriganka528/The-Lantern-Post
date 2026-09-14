import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { MAX_ARCHIVE_BYTES, readArchive, readEnvelope } from './backup-contract';
import type { BackupArchive, EncryptedBackup } from './backup-contract';
export async function encryptArchive(archive: BackupArchive) {
  return encryptBackupBytes('lantern-chat-backup',new TextEncoder().encode(JSON.stringify(readArchive(archive,archive.ownerKey))));
}
export async function encryptBackupBytes(format:EncryptedBackup['format'],bytes:Uint8Array) {
  if(bytes.length>MAX_ARCHIVE_BYTES)throw Error('This archive is too large.');const aad=new TextEncoder().encode(format+':v1:AES-256-GCM');
  const key = await AESEncryptionKey.generate(); const sealed = await aesEncryptAsync(bytes,key,{ nonce:{ length:12 },tagLength:16,additionalData:aad });
  return { envelope:{ format,version:1,algorithm:'AES-256-GCM',data:await sealed.combined('base64') } as EncryptedBackup, recoveryKey:await key.encoded('hex') };
}
export async function decryptArchive(envelope: unknown, recoveryKey: string, ownerKey: string) {
  const bytes=await decryptBackupBytes(envelope,recoveryKey,'lantern-chat-backup');return readArchive(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)),ownerKey);
}
export async function decryptBackupBytes(envelope:unknown,recoveryKey:string,format:EncryptedBackup['format']) {
  const e = readEnvelope(envelope);if(e.format!==format)throw Error('Wrong backup kind.');const aad=new TextEncoder().encode(format+':v1:AES-256-GCM');const text = recoveryKey.trim(); if (!/^[a-f0-9]{64}$/i.test(text)) throw Error('Enter the 64-character recovery key.');
  const key = await AESEncryptionKey.import(text,'hex'); const sealed = AESSealedData.fromCombined(e.data,{ ivLength:12,tagLength:16 });
  const bytes = await aesDecryptAsync(sealed,key,{ additionalData:aad }); if (bytes.length > MAX_ARCHIVE_BYTES) throw Error('Archive too large.');
  return bytes;
}
