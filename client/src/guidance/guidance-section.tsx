import { StyleSheet, Text, View } from 'react-native';
import { GuidanceTarget, useGuidance } from './guidance-context';
import { LanternMark } from '../storybook/ornaments';
import { RoyalNavButton } from '../storybook/royal-navigation';
import { bodyFont, mutedInk, serif } from '../storybook/theme';

export function GuidanceSection() {
  const guide = useGuidance();
  if (!guide) return null;
  return <GuidanceTarget id="guidance" testID="home-guidance" style={styles.section}>
    <View style={styles.heading}><LanternMark size={23} /><View style={{ flex: 1, gap: 5 }}><Text style={styles.eyebrow}>A LANTERN TO GUIDE YOU</Text><Text accessibilityRole="header" style={styles.title}>Guidance, whenever you need it.</Text></View></View>
    <Text style={styles.body}>Take a little walk through your palace. We&apos;ll point out each section, one gentle step at a time.</Text>
    <View style={{ alignSelf: 'flex-start', maxWidth: '100%' }}><RoyalNavButton label="Start guidance" icon="key" onPress={guide.start} /></View>
    {guide.preferenceError && <><Text style={styles.body}>We couldn&apos;t remember your guidance choice on this device. You can still explore normally.</Text><RoyalNavButton label="Remember my guidance choice" onPress={guide.retryPreference} compact /></>}
  </GuidanceTarget>;
}
const styles = StyleSheet.create({
  section: { marginTop: 20, borderTopWidth: 1, borderColor: '#D0BF97', paddingTop: 22, gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  eyebrow: { fontFamily: bodyFont, fontSize: 8, letterSpacing: 1.7, color: '#877044' },
  title: { fontFamily: serif, fontSize: 23, color: '#4A4D3E' },
  body: { fontFamily: bodyFont, color: mutedInk, fontSize: 12, lineHeight: 21 },
});
