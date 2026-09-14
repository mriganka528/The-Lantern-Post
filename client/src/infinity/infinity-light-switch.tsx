import { Pressable, StyleSheet, Text, View } from 'react-native';
import { serif } from '../storybook/theme';
import { useInfinityLighting } from './use-infinity-lighting';
export function InfinityLightSwitch() {
  const { lighting, setLighting } = useInfinityLighting();
  return <View accessibilityRole="radiogroup" accessibilityLabel="Infinity World lighting" style={styles.group}>
    {(['day', 'night'] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={value === 'day' ? 'Day view' : 'Night view'} accessibilityState={{ checked: value === lighting }} aria-checked={value === lighting} onPress={() => setLighting(value)} style={({ pressed }) => [styles.choice, value === lighting && styles.selected, pressed && { opacity: .8 }]}>
      <Text style={[styles.label, value === lighting && { color: '#FFF3D5' }]}>{value === 'day' ? 'Day view' : 'Night view'}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  group: { flexDirection: 'row', padding: 3, gap: 3, borderWidth: 1, borderColor: '#BBA47C', borderRadius: 7, alignSelf: 'flex-start', backgroundColor: '#F6ECD8' },
  choice: { minHeight: 44, minWidth: 80, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 4 },
  selected: { backgroundColor: '#484961' },
  label: { fontFamily: serif, fontSize: 14, color: '#6C573D' },
});
