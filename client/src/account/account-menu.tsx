import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { GetSessionToken } from '../api/client';
import { StoryButton, StoryDialog, s } from '../storybook/story-ui';
import { UsernameCard } from '../friends/username-card';
import { NotificationSettings } from '../notifications/notification-settings';
import { DiagnosticsSettings } from '../diagnostics/diagnostics-settings';
import { PolicyLinks } from '../legal/policy-links';
import { useGuidance } from '../guidance/guidance-context';
import { serif } from '../storybook/theme';
import { StoryIcon } from '../storybook/ornaments';

export function AccountMenu({ ownerId, username, getToken, onClose, onPrivacy, signOut }: {
  ownerId: string; username: string; getToken: GetSessionToken;
  onClose: () => void; onPrivacy: () => void; signOut?: ReactNode;
}) {
  const guidance = useGuidance();
  return <StoryDialog title="Your little corner" onClose={onClose}>
    <View style={styles.identity}><StoryIcon kind="gate" size={27} /><View style={{ flex: 1, gap: 4 }}><Text style={styles.eyebrow}>YOUR PALACE IDENTITY</Text><Text selectable style={styles.username}>@{username}</Text></View></View>
    <View style={styles.group}><Text style={styles.heading}>Your account & keepsakes</Text><UsernameCard username={username} /><StoryButton label="Chat backups & privacy" onPress={onPrivacy} /></View>
    <View style={styles.group}><NotificationSettings ownerId={ownerId} getToken={getToken} compact /></View>
    <View style={styles.group}><Text style={styles.heading}>Preferences & guidance</Text>{guidance && <StoryButton label="Replay palace guidance" secondary onPress={() => { onClose(); guidance.start(); }} />}<DiagnosticsSettings /><Text style={s.body}>Guidance is also available at the bottom of your palace.</Text></View>
    <View style={styles.footer}><Text style={styles.eyebrow}>THE PALACE PAGES</Text><PolicyLinks />{signOut}</View>
  </StoryDialog>;
}
const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingBottom: 4 }, username: { fontFamily: serif, fontSize: 25, color: '#4C5B48' },
  eyebrow: { fontSize: 8, letterSpacing: 1.6, color: '#877044' }, group: { gap: 13, padding: 15, borderWidth: 1, borderColor: '#D7C7A4', borderRadius: 8, backgroundColor: '#F4EDDD' },
  heading: { fontFamily: serif, fontSize: 19, color: '#62543A' }, footer: { gap: 14, paddingTop: 4 },
});
