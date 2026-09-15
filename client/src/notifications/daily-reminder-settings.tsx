import { useState, useSyncExternalStore } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { StoryButton, TextAction, s } from '../storybook/story-ui';
import { serif } from '../storybook/theme';
import type { DailyReminder } from './daily-reminder';
import { dailyReminderAvailable, dailyReminders } from './daily-reminder-driver';

export function DailyReminderSettings({ ownerId }: { ownerId: string }) {
  return dailyReminderAvailable() && dailyReminders ? <ReminderControls ownerId={ownerId} reminders={dailyReminders} /> : null;
}
export function ReminderControls({ ownerId, reminders }: { ownerId: string; reminders: DailyReminder }) {
  const state = useSyncExternalStore(reminders.subscribe, reminders.getSnapshot, reminders.getSnapshot);
  const [error, setError] = useState(false);
  if (state.ownerId !== ownerId) return null;
  const { preference, status } = state;
  const busy = status === 'loading';
  const save = (next: typeof preference) => { setError(false); void reminders.update(ownerId, next).catch(() => setError(true)); };
  return <View style={styles.panel}>
    <Text style={styles.title}>A daily little light</Text>
    <Text style={s.body}>One gentle reminder to return to your palace. Choose a time on this phone.</Text>
    <Pressable accessibilityRole="switch" accessibilityLabel="Daily palace reminder" accessibilityState={{ checked: preference.enabled, disabled: busy }} disabled={busy} onPress={() => save({ ...preference, enabled: !preference.enabled })} style={[styles.toggle, preference.enabled && styles.selected]}><Text style={styles.toggleLabel}>{preference.enabled ? 'Daily reminder on' : 'Daily reminder off'}</Text><Text style={styles.toggleLabel}>{preference.enabled ? 'On' : 'Off'}</Text></Pressable>
    {preference.enabled && <View accessibilityRole="radiogroup" accessibilityLabel="Daily reminder time" style={styles.times}>
      {([{ hour: 9, label: '9 AM' }, { hour: 14, label: '2 PM' }, { hour: 19, label: '7 PM' }]).map(time => <Pressable key={time.hour} accessibilityRole="radio" accessibilityLabel={time.label} accessibilityState={{ checked: preference.hour === time.hour, disabled: busy }} disabled={busy} onPress={() => save({ ...preference, hour: time.hour, minute: 0 })} style={[styles.time, preference.hour === time.hour && styles.selected]}><Text style={styles.toggleLabel}>{time.label}</Text></Pressable>)}
    </View>}
    <Text accessibilityLiveRegion="polite" style={styles.caption}>{busy ? 'Tending your reminder…' : status === 'scheduled' ? 'Set for every day in your phone’s local time. Reminders also work offline.' : status === 'off' ? 'Daily reminders are off on this phone.' : status === 'permission-needed' ? 'Allow notifications on this phone to receive your daily reminder.' : 'Your reminder could not be updated. Please try again.'}</Text>
    {status === 'permission-needed' && <><StoryButton label="Allow reminder notifications" secondary onPress={() => { void reminders.sync(true); }} /><TextAction label="Open phone notification settings" onPress={() => { void Linking.openSettings().catch(() => setError(true)); }} /></>}
    {(status === 'error' || error) && <><Text role="alert" style={s.body}>Your last saved choice is kept. Retry when your phone is ready.</Text><StoryButton label="Retry daily reminder" secondary onPress={() => { setError(false); void reminders.sync(); }} /></>}
  </View>;
}
const styles = StyleSheet.create({
  panel: { width: '100%', gap: 10, borderTopWidth: 1, borderColor: '#D8C9A9', paddingTop: 16, marginTop: 6 },
  title: { fontFamily: serif, fontSize: 19, color: '#5B533F' },
  toggle: { minHeight: 44, padding: 12, borderRadius: 5, borderWidth: 1, borderColor: '#C7B48C', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  toggleLabel: { fontSize: 13, color: '#465448', flexShrink: 1 },
  selected: { backgroundColor: '#E4E9DA', borderColor: '#A2AD91' },
  times: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  time: { minHeight: 44, minWidth: 60, flexGrow: 1, padding: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#D1BE99', borderRadius: 4 },
  caption: { color: '#766A53', fontSize: 11, lineHeight: 18 },
});
