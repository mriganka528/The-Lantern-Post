import { Directory, File, Paths } from 'expo-file-system';
import type { LetterLibraryStorage } from './letter-library';
import { assertPrivateWrite } from '../account/local-privacy';
const watchers = new Set<(key: string) => void>();

function files(key: string) {
  if (!/^[a-zA-Z0-9_%!~*'().-]+$/.test(key)) throw new Error('Invalid storage key.');
  const directory = new Directory(Paths.document, 'lantern-drafts');
  return { directory, file: new File(directory, `${key}.json`), temporary: new File(directory, `${key}.pending`) };
}
function rawRead(key: string) { const { file } = files(key); return file.exists ? file.textSync() : null; }

export const draftStorage: LetterLibraryStorage = {
  cleanupKeys() {const directory=new Directory(Paths.document,'lantern-drafts');return directory.exists?[...new Set(directory.list().filter(file=>file instanceof File && /\.(json|pending)$/.test(file.name)).map(file=>file.name.slice(0,file.name.lastIndexOf('.'))))]:[];},
  keys() { const directory = new Directory(Paths.document, 'lantern-drafts'); return directory.exists ? directory.list().filter(file => file instanceof File && file.name.endsWith('.json')).map(file => file.name.slice(0, -5)) : []; },
  read(key) {
    assertPrivateWrite(key,rawRead);
    const { file } = files(key);
    return file.exists ? file.textSync() : null;
  },
  write(key, value) {
    assertPrivateWrite(key,rawRead);
    const { directory, file, temporary } = files(key);
    directory.create({ intermediates: true, idempotent: true });
    temporary.write(value);
    // Keep the previous complete document until its replacement is written.
    temporary.moveSync(file, { overwrite: true });
    queueMicrotask(() => watchers.forEach(listener => listener(key)));
  },
  remove(key) { const { file, temporary } = files(key); if (file.exists) file.delete(); if (temporary.exists) temporary.delete(); queueMicrotask(() => watchers.forEach(listener => listener(key))); },
  watch(listener) { watchers.add(listener); return () => { watchers.delete(listener); }; },
  subscribe(key, listener) { const changed = (stored: string) => { if (stored === key) listener(); }; watchers.add(changed); return () => { watchers.delete(changed); }; },
};
