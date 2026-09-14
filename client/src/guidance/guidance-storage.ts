import { Directory, File, Paths } from 'expo-file-system';
import type { GuidanceStorage } from './guidance-model';

function location() {
  const directory = new Directory(Paths.document, 'lantern-preferences');
  return { directory, file: new File(directory, 'guidance-v1.txt'), temporary: new File(directory, 'guidance-v1.pending') };
}
// Document storage is removed on uninstall; SecureStore may survive it on iOS.
export const guidanceStorage: GuidanceStorage = {
  read() { const { file } = location(); return file.exists ? file.textSync() : null; },
  write(value) {
    const { directory, file, temporary } = location();
    directory.create({ intermediates: true, idempotent: true });
    temporary.write(value);
    temporary.moveSync(file, { overwrite: true });
  },
};
