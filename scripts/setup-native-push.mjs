// No downloads, account creation, or external writes. Run this after installing
// expo-notifications and expo-device matching client SDK 57.
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(resolve(root, 'client/package.json'));
for (const dependency of ['expo-notifications', 'expo-device']) {
  try {
    const manifest = require(`${dependency}/package.json`);
    if (!manifest.version.startsWith('57.')) throw new Error();
  } catch { throw new Error(`Install ${dependency} for Expo SDK 57 before running setup:push. No files were changed.`); }
}
const template = await readFile(resolve(root, 'scripts/templates/push-driver.native.ts.template'), 'utf8');
const configPath = resolve(root, 'client/app.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const plugins = config.expo.plugins ?? [];
if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === 'expo-notifications')) plugins.push(['expo-notifications', { color: '#C4A777' }]);
config.expo.plugins = plugins;
await writeFile(resolve(root, 'client/src/notifications/push-driver.native.ts'), template);
await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('Native push adapter enabled. Set EXPO_PUBLIC_EAS_PROJECT_ID, configure your app identifiers and push credentials, and build a development client. Expo Go and web continue using in-app invitations.');
