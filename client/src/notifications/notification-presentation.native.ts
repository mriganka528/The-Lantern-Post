import type { Notification, NotificationBehavior } from 'expo-notifications';
import { WELCOME_NOTIFICATION_ID } from './welcome-notification';

type Presentation = (notification: Notification) => Promise<NotificationBehavior>;
let policy: Presentation | null = null;
let installed: Promise<void> | null = null;
const quiet = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
export function ensureNotificationPresentation(): Promise<void> {
  if (!installed) installed = import('expo-notifications').then(notifications => {
    notifications.setNotificationHandler({ handleNotification: async notification => {
      if (notification.request.identifier === WELCOME_NOTIFICATION_ID && notification.request.content.data?.type === 'PALACE_WELCOME') return { ...quiet, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true };
      return policy ? policy(notification) : quiet;
    } });
  }).catch(error => { installed = null; throw error; });
  return installed;
}
export async function registerPushPresentation(next: Presentation): Promise<() => void> {
  await ensureNotificationPresentation(); policy = next;
  return () => { if (policy === next) policy = null; };
}
