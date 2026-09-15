import type { Notification, NotificationBehavior } from 'expo-notifications';
import { WELCOME_NOTIFICATION_ID } from './welcome-notification';
import { DAILY_REMINDER_ID } from './daily-reminder';

type Presentation = (notification: Notification) => Promise<NotificationBehavior>;
let policy: Presentation | null = null;
let installed: Promise<void> | null = null;
const quiet = { shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false };
export function ensureNotificationPresentation(): Promise<void> {
  if (!installed) installed = import('expo-notifications').then(notifications => {
    notifications.setNotificationHandler({ handleNotification: async notification => {
      // Someone already using the palace does not need an interruption asking
      // them to return. The OS presents the scheduled reminder outside the app.
      if (notification.request.identifier === DAILY_REMINDER_ID) return quiet;
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
