import { AppState } from 'react-native';
import { waitForNativeGoogleForeground } from './native-google-state';

export function googleForeground(signal: AbortSignal) {
  return waitForNativeGoogleForeground(() => AppState.currentState, listener => {
    const subscription = AppState.addEventListener('change', listener);
    return () => subscription.remove();
  }, signal);
}
