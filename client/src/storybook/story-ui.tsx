import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { PropsWithChildren, ReactNode, Ref } from 'react';
import { useContext } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flourish, StoryIcon } from './ornaments';
import { bodyFont, gold, ink, line, mutedInk, paper, serif } from './theme';
import { useReducedMotion } from './use-reduced-motion';
import { NavigationActions, navIcon, RoyalNavButton, RoyalPageHeader, WorkspaceNavigation } from './royal-navigation';
import { useBlockingPalaceModal } from '../realtime/palace-live-state';

export function StoryShell({ children, actions, chapter = 'A WORLD FOR YOUR WORDS', scrollRef, beforeBellOpen }: PropsWithChildren<{ actions?: ReactNode; chapter?: string; scrollRef?: Ref<ScrollView>; beforeBellOpen?: () => boolean }>) {
  const { width } = useWindowDimensions();
  const inWorkspace = useContext(WorkspaceNavigation);
  return <SafeAreaView style={s.screen} edges={inWorkspace ? ['left', 'right', 'bottom'] : ['top', 'left', 'right', 'bottom']}>
    <ScrollView ref={scrollRef} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
      <View style={[s.page, width < 600 && s.smallPage]}>
        <RoyalPageHeader chapter={chapter} actions={actions} beforeBellOpen={beforeBellOpen} />
        {children}
        <View style={s.footer}><Flourish width={126} /><Text style={s.footerText}>Some things are lighter when you let them go.</Text><Text style={s.footerSmall}>WITH A LITTLE LIGHT, ALWAYS.</Text></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

export function TextAction({ label, onPress, active = false, disabled = false }: { label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  const navigation = useContext(NavigationActions);
  if (navigation?.hidePalace && label === 'My palace') return null;
  if (navigation) return <RoyalNavButton label={label} onPress={onPress} icon={navIcon(label)} active={active} disabled={disabled} compact />;
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ disabled }} aria-disabled={disabled} disabled={disabled} style={({ pressed }) => [s.textAction, active && s.activeAction, (pressed || disabled) && s.dim]}>
    <Text style={[s.textActionLabel, active && { color: ink }]}>{label}</Text>
  </Pressable>;
}

export function StoryButton({ label, onPress, disabled = false, busy = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} aria-disabled={disabled || busy} aria-busy={busy} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondaryButton, (disabled || busy) && s.dim, pressed && s.pressed]}>
    {!secondary && <StoryIcon kind="key" size={16} color="#E7D5AA" />}
    <Text style={[s.buttonLabel, secondary && { color: ink }]}>{label}</Text>
  </Pressable>;
}

export function StoryHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  const { width } = useWindowDimensions();
  return <View style={[s.heading, width < 600 && { paddingTop: 32, paddingBottom: 28 }]}>
    <Text style={s.eyebrow}>{eyebrow}</Text>
    <Text accessibilityRole="header" style={[s.title, width < 600 && { fontSize: 33, lineHeight: 42 }]}>{title}</Text>
    <Text style={s.subtitle}>{subtitle}</Text>
  </View>;
}

export function StoryDialog({ title, children, onClose }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  useBlockingPalaceModal();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  return <Modal transparent visible animationType={reduced ? 'none' : 'fade'} onRequestClose={onClose}>
    <View style={[s.scrim, width < 600 && { padding: 12 }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close dialog" />
      <View style={[s.dialog, width < 600 && { padding: 16, gap: 14, maxHeight: '94%' }]} accessibilityViewIsModal>
        <View style={s.dialogHeader}><Text accessibilityRole="header" style={s.dialogTitle}>{title}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} style={s.close}><StoryIcon kind="close" /></Pressable></View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 20 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: paper },
  scroll: { flexGrow: 1 },
  page: { width: '100%', maxWidth: 1320, alignSelf: 'center', paddingHorizontal: 48, paddingTop: 8 },
  smallPage: { paddingHorizontal: 16 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: line, gap: 16 },
  brandBlock: { flexDirection: 'row', alignItems: 'center', gap: 11, flexShrink: 1 },
  brand: { fontFamily: serif, fontSize: 22, color: ink, letterSpacing: .5 },
  brandTag: { color: mutedInk, fontSize: 8, letterSpacing: 1.9, marginTop: 4 },
  chapter: { color: mutedInk, fontSize: 9, letterSpacing: 2.2 },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textAction: { minHeight: 44, minWidth: 44, maxWidth: '100%', flexShrink: 1, justifyContent: 'center', paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  activeAction: { borderBottomColor: gold },
  textActionLabel: { fontFamily: bodyFont, color: mutedInk, fontSize: 12 },
  heading: { alignItems: 'center', paddingTop: 44, paddingBottom: 34, gap: 14 },
  eyebrow: { fontFamily: bodyFont, color: '#877044', fontSize: 9, lineHeight: 16, letterSpacing: 2.5, textAlign: 'center' },
  title: { fontFamily: serif, color: ink, fontSize: 46, lineHeight: 57, textAlign: 'center', maxWidth: 900 },
  subtitle: { fontFamily: bodyFont, color: mutedInk, fontSize: 13, lineHeight: 22, textAlign: 'center', maxWidth: 500 },
  body: { fontFamily: bodyFont, color: mutedInk, fontSize: 13, lineHeight: 22 },
  button: { backgroundColor: '#465448', borderWidth: 1, borderColor: '#344438', borderRadius: 4, minHeight: 44, maxWidth: '100%', flexShrink: 1, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  buttonLabel: { fontFamily: bodyFont, color: '#FFF8E9', fontSize: 13, letterSpacing: .3, textAlign: 'center', flexShrink: 1 },
  secondaryButton: { backgroundColor: 'transparent', borderColor: line },
  dim: { opacity: .5 },
  pressed: { opacity: .85, transform: [{ scale: .985 }] },
  footer: { alignItems: 'center', paddingTop: 32, paddingBottom: 28, gap: 10 },
  footerText: { fontFamily: serif, fontSize: 16, fontStyle: 'italic', color: mutedInk, textAlign: 'center' },
  footerSmall: { color: mutedInk, fontSize: 8, letterSpacing: 2, marginTop: 5 },
  scrim: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(42, 39, 31, .42)' },
  dialog: { width: '100%', maxWidth: 430, maxHeight: '90%', backgroundColor: paper, borderColor: gold, borderWidth: 1, padding: 24, borderRadius: 8, gap: 20 },
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  dialogTitle: { fontFamily: serif, fontSize: 25, color: ink, flexShrink: 1 },
  close: { width: 44, height: 44, flexShrink: 0, justifyContent: 'center', alignItems: 'center' },
});
