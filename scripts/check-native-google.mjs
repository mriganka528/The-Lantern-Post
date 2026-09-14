// Local readiness only: never contacts Google/Clerk or reads signing keys.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(new URL('../client/package.json', import.meta.url));
const config = JSON.parse(readFileSync(resolve(root, 'client/app.json'), 'utf8')).expo;
const values = { ...(existsSync(resolve(root, 'client/.env')) ? require('dotenv').parse(readFileSync(resolve(root, 'client/.env'))) : {}), ...process.env };
let missing = 0;
function check(ready, label) { console.log(`${ready ? 'READY' : 'MISSING'}: ${label}`); if (!ready) missing++; }
for (const name of ['@clerk/expo-google-signin', '@react-native-google-signin/google-signin']) {
  let installed = false;
  try { installed = Boolean(require(`${name}/package.json`).version); } catch { /* Report below. */ }
  check(installed, name);
  check(config.plugins?.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === name), `${name} Expo plugin`);
}
check(config.android?.package === 'com.lanternpost.app', 'Android package identity');
const webId = values.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID || config.extra?.EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID;
check(typeof webId === 'string' && /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(webId), 'Public EXPO_PUBLIC_CLERK_GOOGLE_WEB_CLIENT_ID format');
console.log('Clerk setup: its Google connection must use this same Web client ID; this local check cannot verify the dashboard.');
console.log('Google setup: register the actual APK signing SHA-1 and package in the Google Cloud project(s) used for sign-in and Drive.');
console.log('Keep the existing Drive Web client/secret/token key and the existing Clerk instance.');
console.log('A new APK is required. This check cannot verify dashboard credentials, the signing certificate or device behavior.');
if (missing) process.exitCode = 1;
