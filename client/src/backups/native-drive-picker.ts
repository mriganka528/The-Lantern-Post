import type { GoogleSignin } from '@react-native-google-signin/google-signin';
import { assertNativeGoogleActive, NativeGoogleError, withNativeGooglePicker } from '../auth/native-google-state';
import type { NativeDrivePicker } from './native-drive-flow';

export type DriveGoogleSdk = Pick<typeof GoogleSignin, 'configure' | 'hasPlayServices' | 'signIn'>;
export function createNativeDrivePicker(load: () => Promise<DriveGoogleSdk>, foreground: (signal: AbortSignal) => Promise<boolean>): NativeDrivePicker {
  return {
    authorize: (link, signal) => withNativeGooglePicker(signal, async () => {
      try {
        const sdk = await load(); assertNativeGoogleActive(signal);
        sdk.configure({
          webClientId: link.webClientId, scopes: [...link.scopes], offlineAccess: true,
          // The server's begin endpoint confirms this owner has no current
          // refresh token, including after disconnect/reconnection.
          forceCodeForRefreshToken: true,
        });
        if (!await sdk.hasPlayServices({ showPlayServicesUpdateDialog: true })) throw new NativeGoogleError('services');
        assertNativeGoogleActive(signal);
        const result = await sdk.signIn(); assertNativeGoogleActive(signal);
        if (!await foreground(signal)) throw new NativeGoogleError('interrupted');
        if (result.type === 'cancelled') return null;
        if (!result.data.scopes.includes(link.scopes[0]!) || !result.data.serverAuthCode) throw new NativeGoogleError('provider');
        // Google's profile/ID/access tokens never leave this adapter.
        return result.data.serverAuthCode;
      } catch (error) {
        if (error instanceof NativeGoogleError) throw error;
        throw new NativeGoogleError('provider');
      }
    }),
    foreground,
  };
}
