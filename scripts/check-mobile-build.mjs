// Checks build inputs without printing credentials or contacting a provider.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(resolve(root, 'client/package.json'));
const profile = process.argv.find(arg => arg.startsWith('--profile='))?.slice(10) || process.env.EAS_BUILD_PROFILE || 'development';
const clientEnv = resolve(root, 'client/.env');
const values = { ...(existsSync(clientEnv) ? require('dotenv').parse(readFileSync(clientEnv)) : {}), ...process.env };
const config = JSON.parse(readFileSync(resolve(root, 'client/app.json'), 'utf8')).expo;
const profiles = JSON.parse(readFileSync(resolve(root, 'client/eas.json'), 'utf8')).build;
const failures = [];
function check(ok, name) { console.log(`${ok ? 'READY' : 'MISSING'}: ${name}`); if (!ok) failures.push(name); }
if (!profiles[profile]) throw new Error('Choose the development, preview or production build profile.');
const development = profiles[profile].developmentClient === true;
console.log(`Android ${profile}: ${development ? 'development client; Metro supplies the app' : profile === 'preview' ? 'standalone APK' : 'store bundle'}`);
check(config.android?.package === 'com.lanternpost.app' && config.scheme === 'lantern-post', 'App identity and sign-in scheme');
check(existsSync(resolve(root, 'packages/shared-types/package.json')) && existsSync(resolve(root, 'package-lock.json')), 'Workspace packages and root lockfile');
const publicKeys = Object.keys(values).filter(key => key.startsWith('EXPO_PUBLIC_'));
check(!publicKeys.some(key => /SECRET|SERVICE_ROLE|DATABASE|TOKEN_KEY|PRIVATE_KEY/.test(key)), 'No server credentials in public build variables');
let address;
try { address = new URL(values.EXPO_PUBLIC_API_URL); } catch { /* Report a missing/invalid public address below. */ }
const safeAddress = address && ['http:', 'https:'].includes(address.protocol) && !address.username && !address.password && !address.search && !address.hash;
if (development && process.env.EAS_BUILD) console.log('INFO: The development client reads client/.env when Metro runs on your PC.');
else {
  check(Boolean(safeAddress && (development || address.protocol === 'https:' && !/(^|\.)(example\.com|invalid)$/.test(address.hostname))), development ? 'Development API address' : 'HTTPS API address for the standalone app');
  check(/^pk_(test|live)_[A-Za-z0-9_=-]+$/.test(values.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''), 'Clerk publishable key');
  if (profile === 'production') check(/^pk_live_/.test(values.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? ''), 'Production Clerk instance');
  if (development && safeAddress && ['localhost', '127.0.0.1', '10.0.2.2'].includes(address.hostname)) console.log('PHONE SETUP: For a physical phone, use your PC LAN address or an HTTPS API, rather than an emulator/loopback address.');
}
const projectId = values.EXPO_PUBLIC_EAS_PROJECT_ID || config.extra?.eas?.projectId;
console.log(`${projectId ? 'READY' : 'EXPO SETUP'}: ${projectId ? 'Expo project ID supplied' : 'Link your Expo project before a cloud build; local debug builds can proceed without it'}`);
const firebase = values.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile;
console.log(`${firebase && existsSync(resolve(root, 'client', firebase)) ? 'READY' : 'PHONE PUSH SETUP'}: Firebase Android app configuration; local welcome and in-app bells do not require it.`);
check(config.android?.allowBackup === false, 'Local drafts excluded from Android automatic cloud backup');
check(Boolean(profiles.preview?.android?.buildType === 'apk' && !profiles.preview?.developmentClient), 'Standalone preview APK profile');
if (failures.length) { console.log('Fix the missing build inputs before creating this profile. No configuration was changed.'); process.exitCode = 1; }
else console.log('Local build-input checks passed. This does not verify a real phone or publish an app.');
