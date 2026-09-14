// Build without using database credentials, opening a DB connection or migrating.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../server/', import.meta.url));
const require = createRequire(new URL('../server/package.json', import.meta.url));
const env = {
  ...process.env,
  DATABASE_URL: 'postgresql://build:build@127.0.0.1:5432/lantern_build',
  DIRECT_URL: '',
  SHADOW_DATABASE_URL: '',
};

for (const [name, entry, args] of [
  ['Generate Prisma client', 'prisma/build/index.js', ['generate']],
  ['Compile API', '@nestjs/cli/bin/nest.js', ['build']],
]) {
  console.log(name);
  const result = spawnSync(process.execPath, [require.resolve(entry), ...args], {
    cwd: server, env, stdio: 'inherit', windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    console.error(`${name} failed. No database migration was requested.`);
    process.exit(result.status || 1);
  }
}
if (!existsSync(fileURLToPath(new URL('../server/dist/main.js', import.meta.url)))) {
  throw Error('The API build did not produce server/dist/main.js.');
}
console.log('Hosted API compiled. Start with node server/dist/main.js and server-only environment settings.');
