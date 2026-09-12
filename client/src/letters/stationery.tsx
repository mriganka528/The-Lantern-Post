import type { PropsWithChildren } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import type { LetterPreset, StationeryConfig } from '@lantern-post/shared-types';
import { Flourish } from '../storybook/ornaments';
import { serif } from '../storybook/theme';
import { AntiquePaperLayers, PalaceCrest } from './antique-assets';

export function stationeryFont(config: StationeryConfig) {
  return {
    fontFamily: config.font === 'classic' ? Platform.select({ ios: 'Baskerville', android: 'serif', default: 'Palatino Linotype' }) : serif,
    fontStyle: config.font === 'script' ? 'italic' as const : 'normal' as const,
  };
}

export function WaxSeal({ color, size = 54 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 2, borderColor: 'rgba(255,245,207,.26)', justifyContent: 'center', alignItems: 'center', boxShadow: '1px 4px 5px rgba(56,30,22,.28)' }}>
    <View style={{ position: 'absolute', inset: 4, borderWidth: 1, borderColor: 'rgba(255,245,207,.36)', borderRadius: size / 2 }} />
    <PalaceCrest size={size * .75} color="#F3DDAA" />
  </View>;
}

export function PaperFrame({ preset, children }: PropsWithChildren<{ preset: LetterPreset }>) {
  const c = preset.config;
  return <View style={styles.paper}>
    <AntiquePaperLayers preset={preset} />
    <View style={styles.letterhead}><PalaceCrest color={c.inkColor} size={67} /><Text style={[styles.letterheadText, { color: c.inkColor }]}>FROM THE PALACE SCRIPTORIUM</Text><View style={[styles.headRule, { backgroundColor: c.ribbonColor }]} /></View>
    <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
    <View style={styles.ornament}><Flourish width={144} color={c.ribbonColor} /><Text style={{ fontFamily: serif, color: c.inkColor, opacity: .55, fontSize: 11, marginTop: 6 }}>— I —</Text></View>
  </View>;
}

export function MiniStationery({ preset }: { preset: LetterPreset }) {
  return <View style={styles.mini}>
    <AntiquePaperLayers preset={preset} />
    <View style={{ alignItems: 'center', marginTop: 12 }}><PalaceCrest size={26} color={preset.config.inkColor} /></View>
    <View style={{ gap: 6, width: 53, marginTop: 6, marginLeft: 19 }}>
      {[44, 53, 48, 32].map((width, i) => <View key={i} style={{ width, height: .8, backgroundColor: preset.config.inkColor, opacity: .35 }} />)}
    </View>
    <View style={{ position: 'absolute', width: 7, height: 43, backgroundColor: preset.config.ribbonColor, opacity: .6, right: 20, bottom: 6 }} />
    <View style={{ position: 'absolute', right: 10, bottom: 16 }}><WaxSeal color={preset.config.sealColor} size={27} /></View>
  </View>;
}

const styles = StyleSheet.create({
  paper: { paddingHorizontal: 34, paddingTop: 24, paddingBottom: 35, boxShadow: '2px 13px 20px rgba(30,18,9,.27)' },
  letterhead: { alignItems: 'center', gap: 5, marginBottom: 24 },
  letterheadText: { fontSize: 8, letterSpacing: 1.8, textAlign: 'center', lineHeight: 15, opacity: .75 },
  headRule: { width: 94, height: 1, opacity: .35, marginTop: 9 },
  ornament: { alignItems: 'center', marginTop: 26 },
  mini: { width: 94, height: 128, transform: [{ rotate: '-2deg' }], boxShadow: '2px 4px 5px rgba(69,47,27,.2)' },
});
