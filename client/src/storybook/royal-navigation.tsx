import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { StoryIcon } from './ornaments';
import { serif } from './theme';
import { useReducedMotion } from './use-reduced-motion';
import { useAmbientMotion } from './use-ambient-motion';
import { PalaceBell } from '../notifications/palace-bell';

export const WorkspaceNavigation = createContext(false);
export const NavigationActions = createContext<{ hidePalace?: boolean } | null>(null);
type Icon = 'gate' | 'letter' | 'star' | 'key' | 'moon' | 'arrow' | 'close';
export function RoyalNavButton({ label, onPress, icon = 'key', active = false, disabled = false, primary = false, compact = false, grow = false }: {
  label: string; onPress: () => void; icon?: Icon; active?: boolean; disabled?: boolean; primary?: boolean; compact?: boolean; grow?: boolean;
}) {
  const [hovered, setHovered] = useState(false); const [focused, setFocused] = useState(false); const reduced = useReducedMotion(); const { enabled } = useAmbientMotion(); const lit = active || hovered || focused;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} aria-disabled={disabled} disabled={disabled}
    onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={onPress}
    style={({ pressed }) => [styles.button, primary && styles.primary, compact && styles.compactButton, grow && { flex: 1 }, lit && styles.lit, focused && styles.focused, disabled && { opacity: .45 }, pressed && styles.pressed, !reduced && enabled && !disabled && { transform: [{ translateY: pressed ? 1 : lit ? -1 : 0 }] }]}>
    {!compact && <View style={[styles.icon, { pointerEvents: "none" }]}><StoryIcon kind={icon} size={16} color={primary ? '#705126' : '#92723E'} /></View>}
    <Text style={styles.label}>{label}</Text>
  </Pressable>;
}
function Crest({ small = false }: { small?: boolean }) {
  return <View style={[styles.crest, small && { width: 47, height: 57 }]}><View style={styles.crestInset} /><Image source={require('../../assets/storybook/palace-crest.png')} style={{ width: small ? 35 : 44, height: small ? 41 : 54 }} resizeMode="contain" accessible={false} tintColor={'#E5CB91'} /></View>;
}
export function RoyalWorkspaceBar({ children, beforeBellOpen, bellDisabled = false }: { children: ReactNode; beforeBellOpen?: () => boolean; bellDisabled?: boolean }) {
  const { width } = useWindowDimensions(); const narrow = width < 760;
  return <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
    <StatusBar style="light" />
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}><Image source={require('../../assets/storybook/royal-navigation.png')} style={StyleSheet.absoluteFill} resizeMode="stretch" accessible={false} /></View>
    <View testID="royal-workspace-navigation" style={[styles.workspace, narrow && { paddingHorizontal: 12, paddingVertical: 10, gap: 10 }]}>
      <View style={[styles.brandWithBell, narrow && { width: '100%' }]}><View style={styles.brand}><Crest small={narrow} /><View style={{ flexShrink: 1, gap: 5 }}><Text style={styles.eyebrow}>{narrow ? 'THE LANTERN POST' : 'THE LANTERN POST · ROYAL SCRIPTORIUM'}</Text><Text style={[styles.title, narrow && { fontSize: 21, lineHeight: 27 }]}>{narrow ? 'The letter cabinet' : 'The correspondence cabinet'}</Text>{!narrow && <Text style={styles.caption}>A place for every unfinished thought.</Text>}</View></View>{narrow && <PalaceBell beforeOpen={beforeBellOpen} disabled={bellDisabled} />}</View>
      <View style={[styles.buttons, narrow && { width: '100%' }]}>{children}{!narrow && <PalaceBell beforeOpen={beforeBellOpen} disabled={bellDisabled} />}</View>
    </View>
  </SafeAreaView>;
}
export function RoyalPageHeader({ chapter, actions, beforeBellOpen }: { chapter: string; actions?: ReactNode; beforeBellOpen?: () => boolean }) {
  const inside = useContext(WorkspaceNavigation); const { width } = useWindowDimensions();
  if (inside) return <View style={styles.chapterRow}><View style={styles.chapterMark}><StoryIcon kind="star" size={14} color="#9B7C42" /><Text style={styles.chapter}>{chapter}</Text></View><NavigationActions.Provider value={{ hidePalace: true }}><View style={styles.buttons}>{actions}</View></NavigationActions.Provider></View>;
  return <View testID="royal-page-navigation" style={[styles.pageHeader, width < 600 && { padding: 16 }]}>
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}><Image source={require('../../assets/storybook/royal-navigation.png')} style={StyleSheet.absoluteFill} resizeMode="stretch" accessible={false} /></View>
    <View style={[styles.brandWithBell, width < 600 && { width: '100%' }]}><View style={styles.brand}><Crest small /><View style={{ gap: 5, flexShrink: 1 }}><Text style={styles.title}>Lantern Post</Text><Text style={styles.eyebrow}>WRITE IT. SEAL IT. LET IT GO.</Text></View></View>{width < 600 && <PalaceBell beforeOpen={beforeBellOpen} />}</View>
    {width > 1100 && <Text style={styles.headerChapter}>{chapter}</Text>}
    <NavigationActions.Provider value={{}}><View style={[styles.buttons, width < 600 && { width: '100%', justifyContent: 'flex-end' }]}>{actions}{width >= 600 && <PalaceBell beforeOpen={beforeBellOpen} />}</View></NavigationActions.Provider>
  </View>;
}
export function navIcon(label: string): Icon { return /palace|gate|home/i.test(label) ? 'gate' : /letter|inbox/i.test(label) ? 'letter' : /companion|star|world/i.test(label) ? 'star' : /account|guest/i.test(label) ? 'key' : 'arrow'; }
const styles = StyleSheet.create({
  safe: { backgroundColor: '#34483D', borderBottomWidth: 2, borderColor: '#B29457', boxShadow: '0px 5px 16px rgba(42,34,21,.15)' },
  workspace: { width: '100%', maxWidth: 1400, alignSelf: 'center', paddingHorizontal: 32, paddingVertical: 22, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1, minWidth: 0 }, buttons: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', maxWidth: '100%' },
  brandWithBell: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 1, minWidth: 0 },
  title: { color: '#F4E6C6', fontFamily: serif, fontSize: 25, lineHeight: 33 }, eyebrow: { color: '#D5BA7D', fontSize: 8, lineHeight: 13, letterSpacing: 1.6 }, caption: { color: '#D9CAA8', fontFamily: serif, fontSize: 13, fontStyle: 'italic' },
  crest: { width: 59, height: 72, borderTopLeftRadius: 30, borderTopRightRadius: 30, borderBottomLeftRadius: 17, borderBottomRightRadius: 17, backgroundColor: '#405247', borderWidth: 1, borderColor: '#B6985F', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0px 0px 10px rgba(16,24,16,.4)' }, crestInset: { ...StyleSheet.absoluteFill, margin: 4, borderWidth: 1, borderColor: '#8C7C50', borderRadius: 25 },
  button: { minHeight: 44, minWidth: 44, maxWidth: '100%', flexShrink: 1, borderWidth: 1, borderColor: '#C6B18A', borderRadius: 5, backgroundColor: '#F7EEDB', paddingVertical: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  compactButton: { paddingHorizontal: 8, gap: 5 }, primary: { backgroundColor: '#E9D6AA', borderColor: '#B79A62' },
  icon: { width: 16, height: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  label: { fontFamily: serif, color: '#553E24', fontSize: 14, lineHeight: 20, flexShrink: 1, textAlign: 'center' },
  lit: { backgroundColor: '#FFF3D8', borderColor: '#92723E' }, focused: { outlineColor: '#92723E', outlineStyle: 'solid', outlineWidth: 2, outlineOffset: 2 }, pressed: { backgroundColor: '#E5D2A9' },
  pageHeader: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 15, padding: 23, borderWidth: 1, borderColor: '#A78A54', borderTopLeftRadius: 27, borderTopRightRadius: 27, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: '#34483D', overflow: 'hidden' },
  headerChapter: { fontSize: 9, lineHeight: 16, letterSpacing: 1.7, color: '#D9C59B' },
  chapterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#D3BE92', gap: 12 }, chapterMark: { flexDirection: 'row', gap: 8, alignItems: 'center', flexShrink: 1 }, chapter: { color: '#877044', fontSize: 9, letterSpacing: 1.6, lineHeight: 16, flexShrink: 1 },
});
