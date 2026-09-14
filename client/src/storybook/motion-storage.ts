import { Directory, File, Paths } from 'expo-file-system';
import type { MotionStorage } from './ambient-motion-store';
function location() { const directory = new Directory(Paths.document, 'lantern-preferences'); return { directory, file: new File(directory, 'ambient-motion.txt') }; }
export const motionStorage: MotionStorage = {
  read: () => { const { file } = location(); return file.exists ? file.textSync() : null; },
  write: value => { const { directory, file } = location(); directory.create({ intermediates: true, idempotent: true }); file.write(value); },
};
