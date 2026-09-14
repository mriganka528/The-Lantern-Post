import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const configure = require('../client/app.config.js');
const base = () => JSON.parse(readFileSync(new URL('../client/app.json', import.meta.url), 'utf8')).expo;
const savedFile = process.env.GOOGLE_SERVICES_JSON; const savedProject = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
afterEach(() => {
  if (savedFile === undefined) delete process.env.GOOGLE_SERVICES_JSON; else process.env.GOOGLE_SERVICES_JSON = savedFile;
  if (savedProject === undefined) delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID; else process.env.EXPO_PUBLIC_EAS_PROJECT_ID = savedProject;
});
const directory = resolve('.cache/mobile-config-tests'); mkdirSync(directory, { recursive: true });
function file(name, value) { const path = resolve(directory, name); writeFileSync(path, JSON.stringify(value)); return path; }
test('Android generation permits missing Firebase while leaving local notifications available', () => {
  delete process.env.GOOGLE_SERVICES_JSON; delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  const config = base(); config.android.googleServicesFile = './no-test-firebase-file.json'; delete config.extra;
  const result = configure({ config });
  assert.equal(result.android.googleServicesFile, undefined); assert.equal(result.extra.mobile.androidPushConfigured, false);
  assert.ok(result.plugins.some(plugin => Array.isArray(plugin) && plugin[0] === 'expo-notifications'));
});
test('matching Firebase configuration and a linked Expo project prepare remote Android push', () => {
  process.env.GOOGLE_SERVICES_JSON = file('public-app.json', { client: [{ client_info: { android_client_info: { package_name: 'com.lanternpost.app' } } }] });
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = '11111111-2222-4333-8444-555555555555';
  const result = configure({ config: base() }); assert.equal(result.extra.mobile.androidPushConfigured, true); assert.equal(result.extra.eas.projectId, process.env.EXPO_PUBLIC_EAS_PROJECT_ID);
});
test('wrong-package and private service-account files can never be embedded as Android app configuration', () => {
  delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  for (const value of [{ type: 'service_account', private_key: 'SYNTHETIC_PRIVATE_CREDENTIAL' }, { client: [{ client_info: { android_client_info: { package_name: 'another.app' } } }] }]) {
    process.env.GOOGLE_SERVICES_JSON = file('invalid-app.json', value);
    assert.throws(() => configure({ config: base() }), error => !error.message.includes('SYNTHETIC_PRIVATE_CREDENTIAL') && /Android app configuration/.test(error.message));
  }
});
test('an explicitly configured missing file fails instead of silently disabling push', () => {
  process.env.GOOGLE_SERVICES_JSON = resolve(directory, 'missing.json');
  assert.throws(() => configure({ config: base() }), /existing Firebase/);
});
