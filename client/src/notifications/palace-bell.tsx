import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StoryIcon } from '../storybook/ornaments';
import { usePalaceBell } from './bell-context';
import { GuidanceTarget } from '../guidance/guidance-context';
export function PalaceBell({ disabled = false, beforeOpen }: { disabled?: boolean; beforeOpen?: () => boolean }) {
  const bell = usePalaceBell();
  if (!bell) return null;
  return <GuidanceTarget id="bell" style={{ flexShrink: 0 }}><Pressable testID="palace-notification-bell" accessibilityRole="button" accessibilityLabel={`Notifications${bell.unseen ? `, ${bell.unseen} unseen` : ', all seen'}`} accessibilityHint="Open recent letters, messages and invitations" accessibilityState={{ disabled }} disabled={disabled}
    onPress={() => { if (!beforeOpen || beforeOpen()) bell.openBell(); }} style={({ pressed }) => [styles.bell, pressed && { backgroundColor: '#DCC28C' }, disabled && { opacity: .5 }]}>
    <StoryIcon kind="bell" size={25} color="#806034" />
    {bell.unseen > 0 && <View testID="palace-notification-badge" style={styles.badge}><Text style={styles.count}>{bell.unseen > 99 ? '99+' : bell.unseen}</Text></View>}
  </Pressable></GuidanceTarget>;
}
const styles = StyleSheet.create({
  bell: { width: 44, height: 44, flexShrink: 0, borderRadius: 22, borderWidth: 1, borderColor: '#B99B60', backgroundColor: '#F1E3C3', alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: '#854F48', borderWidth: 1, borderColor: '#F9EAC8', alignItems: 'center', justifyContent: 'center' },
  count: { color: '#FFF7E7', fontSize: 10, fontWeight: '600', lineHeight: 14 },
});
