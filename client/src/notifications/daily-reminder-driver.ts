import type { DailyReminder } from './daily-reminder';
export const dailyReminderAvailable = () => false;
export const dailyReminders: DailyReminder | null = null;
export const eraseReminderOwner = async (_ownerId: string) => {};
