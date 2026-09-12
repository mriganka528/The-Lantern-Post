import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

for (const relativePath of ['server/.env', 'client/.env']) {
  const target = new URL(`../${relativePath}`, import.meta.url);
  try {
    await copyFile(new URL(`${target.href}.example`), target, constants.COPYFILE_EXCL);
    console.log(`Created ${fileURLToPath(target)}`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Kept existing ${relativePath}`);
  }
}
