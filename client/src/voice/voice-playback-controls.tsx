import { Pressable, StyleSheet, Text, View } from 'react-native';
import { StoryIcon } from '../storybook/ornaments';

export interface VoicePlayerProps {
  uri: string; durationMs: number; label?: string;
  onRemove?: () => void; removeDisabled?: boolean;
}

export function PlayFromStartButton({ onPress, disabled = false }: { onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Play audio from the beginning" accessibilityHint="Plays the saved audio from the start" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.start, pressed && styles.pressed, disabled && styles.disabled]}>
    <View accessible={false} style={styles.startIcon}><View style={styles.bar} /><View style={styles.triangle} /></View>
    <Text style={styles.caption}>From start</Text>
  </Pressable>;
}

export function RemoveAudioButton({ onPress, disabled = false }: { onPress(): void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel="Remove this recording" accessibilityHint="Opens a confirmation before removing your audio" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.remove, pressed && styles.pressed, disabled && styles.disabled]}>
    <StoryIcon kind="close" size={18} color="#80503B" />
  </Pressable>;
}

const styles = StyleSheet.create({
  start: { minWidth: 44, width: 76, minHeight: 48, flexShrink: 1, padding: 5, gap: 3, borderWidth: 1, borderColor: '#B89A65', borderRadius: 6, backgroundColor: '#F4E8C9', alignItems: 'center', justifyContent: 'center' },
  startIcon: { flexDirection: 'row', alignItems: 'center', width: 17, height: 14, gap: 2 },
  bar: { width: 2, height: 12, backgroundColor: '#795B33' },
  triangle: { width: 0, height: 0, borderTopWidth: 6, borderBottomWidth: 6, borderRightWidth: 10, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: '#795B33' },
  caption: { fontSize: 11, color: '#624C32', textAlign: 'center' },
  remove: { width: 44, height: 44, borderWidth: 1, borderColor: '#AF8765', borderRadius: 22, backgroundColor: '#F3E1D1', alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: '#E7CFAE' }, disabled: { opacity: .5 },
});
