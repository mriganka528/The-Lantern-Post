import { StyleSheet, Text, View } from 'react-native';
import { serif } from '../storybook/theme';
export function VoiceCaption({ text }: { text?: string | null }) { return text ? <View style={styles.box}><Text style={styles.label}>WORDS TO READ ALONG</Text><Text selectable accessibilityLabel="Written words for this voice letter" style={styles.words}>{text}</Text></View> : null; }
const styles = StyleSheet.create({ box: { paddingVertical: 18, width: '100%', gap: 10 }, label: { fontSize: 9, letterSpacing: 1.3, lineHeight: 18, color: '#8B7651' }, words: { fontFamily: serif, fontSize: 18, lineHeight: 29, color: '#574934' } });
