import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { StoryDialog, TextAction, s } from '../storybook/story-ui';
import { StoryIcon } from '../storybook/ornaments';
import { serif } from '../storybook/theme';
import { SUPPORT_RESOURCES } from './support-resources';
export function SupportResources({ onClose }: { onClose: () => void }) {
  const [error, setError] = useState(false);
  return <StoryDialog title="A little support, within reach" onClose={onClose}><Text style={s.body}>You do not have to carry a difficult moment alone. A trusted person or a confidential helpline can listen.</Text><Text style={s.body}>If you are in immediate danger, call your local emergency number or go to the nearest emergency department.</Text>{SUPPORT_RESOURCES.map(resource => <TextAction key={resource.url} label={resource.label} onPress={() => { setError(false); void Linking.openURL(resource.url).catch(() => setError(true)); }} />)}{error && <Text role="alert" style={s.body}>This link could not open. You can visit findahelpline.com or dial the number shown above.</Text>}<TextAction label="Return to my quiet moment" onPress={onClose} /></StoryDialog>;
}
export function SupportCard({ visible = true }: { visible?: boolean }) {
  const [dismissed, setDismissed] = useState(false); const [open, setOpen] = useState(false);
  if (dismissed || !visible) return null;
  return <View style={styles.card}><View style={styles.titleRow}><StoryIcon kind="moon" size={22} /><Text style={styles.title}>You can leave room for support, too.</Text></View><Text style={s.body}>If these words are about you, someone can listen. Your letter is still yours to write, seal or release.</Text><View style={styles.actions}><TextAction label="Find someone to talk to" onPress={() => setOpen(true)} /><TextAction label="Keep writing" onPress={() => setDismissed(true)} /></View>{open && <SupportResources onClose={() => setOpen(false)} />}</View>;
}
const styles = StyleSheet.create({ card: { padding: 18, gap: 10, marginTop: 18, backgroundColor: '#EAF0E2', borderColor: '#A7B59E', borderWidth: 1, borderRadius: 5 }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, title: { flex: 1, fontFamily: serif, color: '#596C54', fontSize: 19, lineHeight: 26 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 } });
