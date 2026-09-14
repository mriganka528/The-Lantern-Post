/* global __dirname */
const { existsSync, readFileSync } = require('node:fs');
const { isAbsolute, resolve } = require('node:path');

// Native builds can use local notifications before Firebase is configured.
// Only Google's public Android app config is eligible for inclusion in the APK.
module.exports = ({ config }) => {
  const android = { ...config.android };
  const configuredPath = process.env.GOOGLE_SERVICES_JSON || android.googleServicesFile || './google-services.json';
  const file = isAbsolute(configuredPath) ? configuredPath : resolve(__dirname, configuredPath);
  const hasFirebase = existsSync(file);
  if (hasFirebase) {
    let firebase;
    try { firebase = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new Error('The Firebase Android app configuration is not valid JSON.'); }
    if (firebase.type === 'service_account' || firebase.private_key || !firebase.client?.some(item => item.client_info?.android_client_info?.package_name === android.package)) {
      throw new Error('Use the Firebase Android app configuration matching the app package, never an FCM service-account key.');
    }
    android.googleServicesFile = configuredPath;
  } else {
    if (process.env.GOOGLE_SERVICES_JSON) throw new Error('GOOGLE_SERVICES_JSON must point to an existing Firebase Android app configuration file.');
    delete android.googleServicesFile;
  }
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || config.extra?.eas?.projectId;
  if (projectId && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(projectId)) throw new Error('The Expo project ID must be a UUID.');
  return {
    ...config,
    android,
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}), mobile: { androidPushConfigured: hasFirebase && Boolean(projectId) } },
  };
};
