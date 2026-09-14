import { readEnvelope } from './backup-contract';
import type { EncryptedBackup } from './backup-contract';
export async function exportBackup(envelope:EncryptedBackup) {const uri=URL.createObjectURL(new Blob([JSON.stringify(readEnvelope(envelope))],{type:'application/json'}));const link=document.createElement('a');link.href=uri;link.download=envelope.format==='lantern-voice-backup'?'lantern-voice.lanternbackup':'lantern-chat.lanternbackup';link.click();setTimeout(()=>URL.revokeObjectURL(uri),1000);}
export async function importBackup() {
  return new Promise<EncryptedBackup|null>((resolve,reject)=>{const input=document.createElement('input');input.type='file';input.accept='.lanternbackup,application/json';input.oncancel=()=>resolve(null);input.onchange=()=>{void(async()=>{try {const file=input.files?.[0];if(!file){resolve(null);return;}if(file.size>15*1024*1024)throw Error('Backup too large.');resolve(readEnvelope(JSON.parse(await file.text())));}catch{reject(Error('This backup file could not be opened.'));}})();};input.click();});
}
export function prepareDriveWindow() {const child=window.open('about:blank','_blank','popup,width=560,height=720');return {open(url:string){if(!child)throw Error('Allow the Google sign-in window in your browser.');child.opener=null;child.location.href=url;},close(){child?.close();}};}
