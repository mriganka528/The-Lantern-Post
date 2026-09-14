import { TurboModuleRegistry } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { apiRequest } from '../api/client';
import type { GetSessionToken } from '../api/client';
import { googleForeground } from '../auth/native-google-foreground';
import { prepareDriveWindow } from './backup-files';
import { connectNativeDrive } from './native-drive-flow';
import type { NativeDriveLink } from './native-drive-flow';
import type { DriveConnector } from './drive-connector';
import { createNativeDrivePicker } from './native-drive-picker';

async function nativeConnection(getToken: GetSessionToken, signal: AbortSignal) {
  return connectNativeDrive({
    begin: current => apiRequest<NativeDriveLink>('/backups/drive/native/connect', getToken, { method: 'POST', signal: current }),
    complete: (link, code, current) => apiRequest<{ connected: boolean }>('/backups/drive/native/complete', getToken, { method: 'POST', signal: current, body: { id: link.id, state: link.state, code } }),
    cancel: (link, current) => apiRequest('/backups/drive/native/cancel', getToken, { method: 'POST', signal: current, body: { id: link.id, state: link.state } }),
  }, createNativeDrivePicker(async () => {
    // Avoid evaluating the SDK's enforcing TurboModule import in an older APK.
    const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
    return GoogleSignin;
  }, googleForeground), signal);
}

export function prepareDriveConnector(): DriveConnector {
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient || !TurboModuleRegistry.get('RNGoogleSignin')) {
    return { kind: 'browser', window: prepareDriveWindow() };
  }
  return { kind: 'native', connect: nativeConnection };
}
