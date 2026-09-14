import { assertAccountOpen } from '../account/account-fence';
import { readEnvelope } from './backup-contract';
import type { EncryptedBackup } from './backup-contract';
interface Row { id:string; ownerId:string; createdAt:string; envelope:EncryptedBackup; }
async function run<T>(mode:IDBTransactionMode, work:(store:IDBObjectStore)=>IDBRequest<T>) {
  const db = await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('lantern-backups-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('backups',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(Error('Backup storage unavailable.'));});
  try { return await new Promise<T>((resolve,reject)=>{const tx=db.transaction('backups',mode);const request=work(tx.objectStore('backups'));let value:T;request.onsuccess=()=>{value=request.result;};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(Error('Backup could not be saved.'));}); } finally {db.close();}
}
export const backupStore = {
  async list(ownerId:string) { assertAccountOpen(ownerId); return (await run('readonly',s=>s.getAll()) as Row[]).filter(r=>r.ownerId===ownerId).map(r=>({id:r.id,createdAt:r.createdAt})); },
  async save(ownerId:string,id:string,envelope:EncryptedBackup) { assertAccountOpen(ownerId);if ((await this.list(ownerId)).length>=10) throw Error('Remove an older local backup first.');await run('readwrite',s=>s.put({id,ownerId,createdAt:new Date().toISOString(),envelope:readEnvelope(envelope)}));try {assertAccountOpen(ownerId);} catch {await this.eraseOwner(ownerId);throw Error('Account closed.');} },
  async read(ownerId:string,id:string) { assertAccountOpen(ownerId);const row=await run('readonly',s=>s.get(id)) as Row|undefined;if(row?.ownerId!==ownerId) throw Error('Backup unavailable.');return readEnvelope(row.envelope); },
  async remove(ownerId:string,id:string) { const row=await run('readonly',s=>s.get(id)) as Row|undefined;if(row?.ownerId===ownerId) await run('readwrite',s=>s.delete(id)); },
  async eraseOwner(ownerId:string) { for(const row of await run('readonly',s=>s.getAll()) as Row[]) if(row.ownerId===ownerId) await run('readwrite',s=>s.delete(row.id)); },
};
