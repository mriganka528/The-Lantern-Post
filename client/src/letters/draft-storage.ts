import { Directory, File, Paths } from 'expo-file-system';
import type { DraftStorage } from './draft';

function files(key: string) {
  const directory = new Directory(Paths.document, 'lantern-drafts');
  return { directory, file: new File(directory, `${key}.json`), temporary: new File(directory, `${key}.pending`) };
}

export const draftStorage: DraftStorage = {
  read(key) {
    const { file } = files(key);
    return file.exists ? file.textSync() : null;
  },
  write(key, value) {
    const { directory, file, temporary } = files(key);
    directory.create({ intermediates: true, idempotent: true });
    temporary.write(value);
    // Keep the previous complete document until its replacement is written.
    temporary.moveSync(file, { overwrite: true });
  },
};
