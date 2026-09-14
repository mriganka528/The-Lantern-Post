import { useEffect } from 'react';
import { AppState } from 'react-native';
import { ensureWelcome, welcomeAvailable } from './welcome-driver';
import { ensureNotificationPresentation } from './notification-presentation.native';

export function WelcomeNotificationSession() {
  useEffect(() => {
    if (!welcomeAvailable()) return;
    void ensureNotificationPresentation().catch(() => { /* Scheduling can retry initialization. */ });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const start = () => { clearTimeout(timer); if (AppState.currentState === 'active') timer = setTimeout(() => { void ensureWelcome().catch(() => { /* Settings offers a retry; keep first launch usable. */ }); }, 1500); };
    start(); const subscription = AppState.addEventListener('change', start);
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return null;
}
