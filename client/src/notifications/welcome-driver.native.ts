import Constants, { ExecutionEnvironment } from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { ensureNotificationPresentation } from './notification-presentation.native';
import { WelcomeNotification, WELCOME_NOTIFICATION_ID, welcomeNote } from './welcome-notification';
import { dailyReminders } from './daily-reminder-driver.native';

export const welcomeAvailable = () => ['android', 'ios'].includes(Platform.OS) && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
const marker = () => new File(Paths.document, 'lantern-welcome-v1.txt');
const welcome = new WelcomeNotification({
  available: welcomeAvailable,
  read: async () => { const file = marker(); return file.exists ? file.text() : null; },
  write: async value => { marker().write(value); },
  permission: async ask => {
    const notifications = await import('expo-notifications');
    if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('palace-welcome', { name: 'Palace welcome', importance: notifications.AndroidImportance.HIGH, lightColor: '#C4A777', vibrationPattern: [0, 150] });
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted && ask && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
    return permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
  },
  exists: async () => {
    const notifications = await import('expo-notifications');
    const [scheduled, presented] = await Promise.all([notifications.getAllScheduledNotificationsAsync(), notifications.getPresentedNotificationsAsync()]);
    return scheduled.some(note => note.identifier === WELCOME_NOTIFICATION_ID) || presented.some(note => note.request.identifier === WELCOME_NOTIFICATION_ID);
  },
  schedule: async () => {
    await ensureNotificationPresentation();
    const notifications = await import('expo-notifications');
    await notifications.scheduleNotificationAsync({ identifier: WELCOME_NOTIFICATION_ID, content: { ...welcomeNote, sound: 'default' }, trigger: { type: notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, repeats: false, channelId: 'palace-welcome' } });
  },
});
export const ensureWelcome = async (manual = false) => {
  const result = await welcome.ensure(manual);
  // Reconcile after the first OS permission sheet finishes, even if Android's
  // foreground event arrived before its permission result was committed.
  if (result === 'complete') void dailyReminders.sync();
  return result;
};
