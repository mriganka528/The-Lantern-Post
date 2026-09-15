import { useEffect } from 'react';
import { AppState } from 'react-native';
import { dailyReminderAvailable, dailyReminders } from './daily-reminder-driver';

export function useDailyReminderSession(ownerId: string) {
  useEffect(() => {
    if (!dailyReminderAvailable() || !dailyReminders) return;
    const stop = dailyReminders.activate(ownerId || null);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void dailyReminders?.sync(); });
    return () => { subscription.remove(); stop(); };
  }, [ownerId]);
}
