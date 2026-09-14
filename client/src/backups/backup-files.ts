import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { File,Paths } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { readEnvelope } from './backup-contract';
import { Platform } from 'react-native';
import type { EncryptedBackup } from './backup-contract';
export async function exportBackup(envelope:EncryptedBackup) {if(!await Sharing.isAvailableAsync())throw Error('File sharing is unavailable.');const file=new File(Paths.cache,randomUUID()+'.lanternbackup');try{file.write(JSON.stringify(readEnvelope(envelope)));await Sharing.shareAsync(file.uri,{mimeType:'application/json',dialogTitle:'Save encrypted chat backup'});}finally{if(file.exists)file.delete();}}
export async function importBackup() {const result=await DocumentPicker.getDocumentAsync({copyToCacheDirectory:true,multiple:false,type:'*/*'});if(result.canceled)return null;const asset=result.assets[0];if(!asset) return null;const file=new File(asset.uri);try{if(file.size>15*1024*1024)throw Error('Backup too large.');return readEnvelope(JSON.parse(file.textSync()));}finally{if(file.uri.startsWith(Paths.cache.uri) && file.exists)file.delete();}}
export function prepareDriveWindow() {return {
  async open(url:string) { await WebBrowser.openBrowserAsync(url); },
  close() { if (Platform.OS === 'ios') void WebBrowser.dismissBrowser()?.catch(() => {}); },
};}
