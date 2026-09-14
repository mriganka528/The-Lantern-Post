// Configure the existing Drive integration without contacting Google or Render.
// Import the OAuth Web-client download, never the Firebase FCM service-account key.
import { existsSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { replaceEnvValues, HOSTED_API } from './configure-api.mjs';
const require = createRequire(import.meta.url);
const { parse } = require('dotenv');
const { driveSettings } = require('../server/src/backups/drive-config.ts');
const root = fileURLToPath(new URL('../', import.meta.url));
export const DRIVE_CALLBACK = `${HOSTED_API}/backups/drive/callback`;

function oauthClient(input, redirectUri) {
  const web = input && typeof input === 'object' && !Array.isArray(input) && input.web;
  if (!web || typeof web !== 'object' || Array.isArray(web) || input.type === 'service_account' || input.private_key) {
    throw Error('Download a Google OAuth Web application client JSON, not an Android/Desktop client or Firebase service-account key.');
  }
  if (typeof web.client_id !== 'string' || !/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(web.client_id) ||
      typeof web.client_secret !== 'string' || !/^[A-Za-z0-9._-]{8,512}$/.test(web.client_secret)) {
    throw Error('The OAuth Web client download must contain a valid client ID and client secret.');
  }
  if (!Array.isArray(web.redirect_uris) || !web.redirect_uris.includes(redirectUri)) {
    throw Error('Add the exact Render callback to Authorized redirect URIs, then download the OAuth client JSON again.');
  }
  return { clientId: web.client_id, clientSecret: web.client_secret };
}

export function prepareDriveSettings(source, credentials, redirectUri = DRIVE_CALLBACK) {
  const existing = parse(source);
  const client = oauthClient(credentials, redirectUri);
  if (existing.GOOGLE_DRIVE_CLIENT_ID && existing.GOOGLE_DRIVE_CLIENT_ID !== client.clientId) {
    throw Error('Drive already uses another OAuth client. Review existing connections before changing clients.');
  }
  // Reusing this key preserves existing encrypted tokens and pending cleanup.
  const key = existing.GOOGLE_DRIVE_TOKEN_KEY || randomBytes(32).toString('base64');
  const values = {
    GOOGLE_DRIVE_CLIENT_ID: client.clientId,
    GOOGLE_DRIVE_CLIENT_SECRET: client.clientSecret,
    GOOGLE_DRIVE_REDIRECT_URI: redirectUri,
    GOOGLE_DRIVE_TOKEN_KEY: key,
  };
  driveSettings(values, true);
  return replaceEnvValues(source, values);
}

export function configureDrive({ credentialsPath, envPath = resolve(root, 'server/.env'), redirectUri = DRIVE_CALLBACK }) {
  if (!credentialsPath) throw Error('Provide --credentials="PATH_TO_OAUTH_WEB_CLIENT_JSON".');
  if (!existsSync(envPath)) throw Error('Create server/.env before configuring Drive.');
  let credentials;
  try {
    if (statSync(credentialsPath).size > 1024 * 1024) throw Error();
    credentials = JSON.parse(readFileSync(credentialsPath, 'utf8').replace(/^\uFEFF/, ''));
  } catch { throw Error('The OAuth client JSON could not be read. Check the file path and JSON download.'); }
  const source = readFileSync(envPath, 'utf8');
  const next = prepareDriveSettings(source, credentials, redirectUri);
  if (next === source) return;
  const temporary = `${envPath}.drive-${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, next, { flag: 'wx', mode: 0o600 });
    if (readFileSync(envPath, 'utf8') !== source) throw Error('The server environment changed during setup. Retry after saving your edits.');
    renameSync(temporary, envPath);
  } finally { if (existsSync(temporary)) unlinkSync(temporary); }
}

export function checkDriveConfig(envPath = resolve(root, 'server/.env')) {
  if (!existsSync(envPath)) throw Error('Create server/.env before checking Drive.');
  const settings = driveSettings(parse(readFileSync(envPath, 'utf8')), true);
  if (!settings) throw Error('Drive is not configured yet. Import the OAuth Web client JSON first.');
  return { redirectUri: settings.redirectUri };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.includes('--check')) {
      checkDriveConfig();
      console.log('Local Drive settings validate. Google consent, Render settings and a real backup still need verification.');
    } else {
      const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
      configureDrive({ credentialsPath: arg('credentials'), redirectUri: arg('redirect-uri') || DRIVE_CALLBACK });
      console.log('Saved all four GOOGLE_DRIVE settings in server/.env. Existing token encryption keys were preserved.');
      console.log('Copy those four values directly into Render Environment, save and redeploy. Keep the token key stable and private.');
      console.log('No client settings, database records, Google files or hosted settings were changed. No credentials were printed.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    // Print only messages defined by our validators, never filesystem paths,
    // OAuth JSON contents, native parser errors or provider responses.
    const safe = /^(Download a Google|The OAuth Web|Add the exact|Drive already|Provide --credentials|Create server|The OAuth client JSON could|The server environment changed|Drive is not configured|Configure all GOOGLE_DRIVE|Google Drive requires|GOOGLE_DRIVE_TOKEN_KEY)/;
    console.error(safe.test(message) ? message : 'Drive setup could not save the settings. Check file access and retry.');
    process.exitCode = 1;
  }
}
