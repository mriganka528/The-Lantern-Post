import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PropsWithChildren } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flourish, LanternMark } from '../storybook/ornaments';
import { gold, ink, line, paper, serif } from '../storybook/theme';
import { PolicyLinks } from '../legal/policy-links';

export function AuthPage({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle?: string }>) {
  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.ornament}><LanternMark size={42} /></View>
            <Text style={styles.brand}>LANTERN POST</Text>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            <View style={styles.form}>{children}</View>
            <View style={styles.ornamentBottom}><Flourish /></View>
            <PolicyLinks />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function ActionButton({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} aria-disabled={disabled} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [styles.button, secondary && styles.secondaryButton, (disabled || pressed) && styles.dimmed]}>
      <Text style={[styles.buttonLabel, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

export function AgeConfirmation({ checked, onChange, disabled = false }: { checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityLabel="I am at least 13 years old" accessibilityState={{ checked, disabled }} aria-checked={checked} aria-disabled={disabled}
      onPress={() => onChange(!checked)} disabled={disabled} style={styles.checkboxRow}>
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
      </View>
      <Text style={styles.checkboxLabel}>I am at least 13 years old.</Text>
    </Pressable>
  );
}

export function FormError({ message }: { message: string | null }) {
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{message}</Text> : null;
}

export function LoadingScreen() {
  return <AuthPage title="Opening your gate…"><Image source={require('../../assets/storybook/app-foreground.png')} style={{ width: 128, height: 128, alignSelf: 'center' }} resizeMode="contain" accessible={false} /><ActivityIndicator size="large" color="#73563C" accessibilityLabel="Loading" /></AuthPage>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paper },
  fill: { flex: 1 },
  page: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 460, paddingHorizontal: 12 },
  ornament: { alignItems: 'center', marginBottom: 18 },
  ornamentBottom: { alignItems: 'center', marginTop: 28 },
  brand: { color: gold, fontSize: 10, letterSpacing: 3, marginBottom: 22, textAlign: 'center' },
  title: { color: ink, fontFamily: serif, fontSize: 34, lineHeight: 44, textAlign: 'center' },
  subtitle: { color: '#6D5C4C', fontSize: 16, lineHeight: 24, marginTop: 12, textAlign: 'center' },
  form: { marginTop: 28, gap: 16 },
  label: { color: '#3E332A', fontSize: 16, fontWeight: '500', marginBottom: 8 },
  input: { backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: line, borderRadius: 4, padding: 16, fontSize: 17, color: ink, minHeight: 54 },
  hint: { color: '#6D5C4C', fontSize: 14, lineHeight: 21 },
  button: { borderRadius: 4, backgroundColor: '#465448', minHeight: 50, paddingHorizontal: 18, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#B9A48E' },
  secondaryLabel: { color: '#594431' },
  dimmed: { opacity: 0.5 },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  checkbox: { width: 26, height: 26, borderRadius: 5, borderWidth: 1, borderColor: '#73563C', justifyContent: 'center', alignItems: 'center' },
  checkboxChecked: { backgroundColor: '#73563C' },
  checkmark: { color: '#FFFFFF', fontSize: 18, fontWeight: '600' },
  checkboxLabel: { flex: 1, color: '#3E332A', fontSize: 15 },
  error: { color: '#983D2B', fontSize: 15, lineHeight: 22 },
  available: { color: '#3C6543', fontSize: 14 },
});
