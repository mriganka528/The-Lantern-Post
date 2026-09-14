import { Directory, File, Paths } from 'expo-file-system';
import { assertAccountOpen } from '../account/account-fence';
import { readEnvelope } from './backup-contract';
import type { EncryptedBackup } from './backup-contract';
function directory(ownerId:string) { if(!/^[a-zA-Z0-9_-]{1,100}$/.test(ownerId)) throw Error();return new Directory(Paths.document,'lantern-backups',ownerId); }
function file(ownerId:string,id:string) {if(!/^[a-f0-9-]{36}$/i.test(id)) throw Error();return new File(directory(ownerId),id+'.json');}
export const backupStore = {
  async list(ownerId:string) {assertAccountOpen(ownerId);const dir=directory(ownerId);return dir.exists?dir.list().filter(f=>f instanceof File && f.name.endsWith('.json')).map(f=>({id:f.name.slice(0,-5),createdAt:new Date((f as File).modificationTime??Date.now()).toISOString()})):[];},
  async save(ownerId:string,id:string,envelope:EncryptedBackup) {assertAccountOpen(ownerId);if((await this.list(ownerId)).length>=10) throw Error('Remove an older local backup first.');assertAccountOpen(ownerId);directory(ownerId).create({idempotent:true,intermediates:true});file(ownerId,id).write(JSON.stringify(readEnvelope(envelope)));},
  async read(ownerId:string,id:string) {assertAccountOpen(ownerId);const f=file(ownerId,id);if(f.size>15*1024*1024) throw Error('Backup too large.');return readEnvelope(JSON.parse(f.textSync()));},
  async remove(ownerId:string,id:string) {const f=file(ownerId,id);if(f.exists) f.delete();},
  async eraseOwner(ownerId:string) {const dir=directory(ownerId);if(dir.exists) dir.delete();},
};
