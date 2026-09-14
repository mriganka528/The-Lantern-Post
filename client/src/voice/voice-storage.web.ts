import type { VoiceStore } from './voice-contract';
import { cleanVoiceClip } from './voice-contract';
import { assertAccountOpen } from '../account/account-fence';
const database = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('lantern-voice-v1', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('clips');
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('Voice storage is unavailable.'));
});
function key(ownerId: string, clipId: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(ownerId) || !/^[a-f0-9-]{36}$/i.test(clipId)) throw new Error('Invalid recording owner.');
  return `${ownerId}:${clipId}`;
}
async function run<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await database();
  try { return await new Promise<T>((resolve, reject) => {
    const tx = db.transaction('clips', mode); const request = operation(tx.objectStore('clips')); let result: T;
    request.onsuccess = () => { result = request.result; };
    tx.oncomplete = () => resolve(result); tx.onabort = tx.onerror = () => reject(new Error('The recording could not be saved on this device.'));
  }); } finally { db.close(); }
}
export const voiceStorage: VoiceStore = {
  async save(ownerId, clip, bytes) {
    assertAccountOpen(ownerId);
    if (!cleanVoiceClip(clip) || bytes.byteLength !== clip.byteLength) throw new Error('Invalid recording.');
    await run('readwrite', store => store.put(new Blob([bytes.slice().buffer], { type: clip.mimeType }), key(ownerId, clip.id)));
    try { assertAccountOpen(ownerId); } catch { await voiceStorage.remove(ownerId,clip.id); throw Error('Account closed.'); }
  },
  async read(ownerId, clip) { const blob = await run('readonly', store => store.get(key(ownerId, clip.id))) as Blob | undefined;
    if (!(blob instanceof Blob) || blob.size !== clip.byteLength || blob.type !== clip.mimeType) throw new Error('The saved recording is unavailable.');
    return new Uint8Array(await blob.arrayBuffer());
  },
  async remove(ownerId, clipId) { await run('readwrite', store => store.delete(key(ownerId, clipId))); },
  async playback(ownerId, clip) { const bytes = await voiceStorage.read(ownerId, clip); const uri = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: clip.mimeType })); return { uri, release: () => URL.revokeObjectURL(uri) }; },
  async sha256(bytes) { const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer); return btoa(String.fromCharCode(...new Uint8Array(digest))); },
};
export async function eraseVoiceOwner(ownerId: string) {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(ownerId)) throw Error();
  const db = await database();
  try { await new Promise<void>((resolve,reject) => { const tx = db.transaction('clips','readwrite'); const store = tx.objectStore('clips'); const cursor = store.openCursor(IDBKeyRange.bound(ownerId+':',ownerId+':\uffff')); cursor.onsuccess = () => { const row = cursor.result; if (row) { row.delete(); row.continue(); } }; tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(Error('Recording cleanup failed.')); }); } finally { db.close(); }
}
