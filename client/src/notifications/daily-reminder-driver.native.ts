import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { draftStorage } from '../letters/draft-storage';
import { closedAccountKey } from '../account/local-privacy';
import { DailyReminder, DAILY_REMINDER_ID, dailyReminderKey, dailyReminderNote, parseReminderPreference } from './daily-reminder';
import { ensureNotificationPresentation } from './notification-presentation.native';

export const dailyReminderAvailable = () => ['android', 'ios'].includes(Platform.OS) && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;
export const dailyReminders = new DailyReminder({
  available: dailyReminderAvailable,
  read: ownerId => parseReminderPreference(draftStorage.read(dailyReminderKey(ownerId))),
  write: (ownerId, preference) => draftStorage.write(dailyReminderKey(ownerId), JSON.stringify({ version: 1, ...preference })),
  closed: ownerId => draftStorage.read(closedAccountKey(ownerId)) === 'closed',
  timezone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  permission: async ask => {
    const notifications = await import('expo-notifications');
    if (Platform.OS === 'android') await notifications.setNotificationChannelAsync('palace-reminders', { name: 'Daily palace reminders', importance: notifications.AndroidImportance.DEFAULT, lightColor: '#C4A777', vibrationPattern: [0, 100] });
    let permission = await notifications.getPermissionsAsync();
    if (!permission.granted && ask && permission.canAskAgain) permission = await notifications.requestPermissionsAsync();
    return permission.granted || permission.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL;
  },
  scheduled: async () => {
    const notifications = await import('expo-notifications');
    const note = (await notifications.getAllScheduledNotificationsAsync()).find(item => item.identifier === DAILY_REMINDER_ID);
    if (!note) return null;
    const data = note.content.data ?? {};
    return { ownerId: typeof data.ownerId === 'string' ? data.ownerId : '', hour: typeof data.hour === 'number' ? data.hour : -1, minute: typeof data.minute === 'number' ? data.minute : -1, timezone: typeof data.timezone === 'string' ? data.timezone : '' };
  },
  schedule: async reminder => {
    await ensureNotificationPresentation();
    const notifications = await import('expo-notifications');
    await notifications.scheduleNotificationAsync({ identifier: DAILY_REMINDER_ID,
      content: { ...dailyReminderNote, sound: 'default', data: { type: 'PALACE_DAILY_REMINDER', ...reminder } },
      trigger: { type: notifications.SchedulableTriggerInputTypes.DAILY, hour: reminder.hour, minute: reminder.minute, channelId: 'palace-reminders' },
    });
  },
  cancel: async () => {
    const notifications = await import('expo-notifications');
    await notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
    await notifications.dismissNotificationAsync(DAILY_REMINDER_ID);
  },
});
export const eraseReminderOwner = (ownerId: string) => dailyReminders.eraseOwner(ownerId);
