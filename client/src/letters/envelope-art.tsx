import { StyleSheet, View } from 'react-native';
import type { LetterPreset } from '@lantern-post/shared-types';
import { AntiquePaperLayers } from './antique-assets';
import { WaxSeal } from './stationery';
export function EnvelopeArt({ preset, width = 170 }: { preset: LetterPreset; width?: number }) {
  const height = width * .62;
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width, height, backgroundColor: preset.config.paperColor, borderWidth: 1, borderColor: preset.config.ribbonColor, borderRadius: 3, overflow: 'hidden' }}>
    <AntiquePaperLayers preset={preset} />
    <View style={{ position: 'absolute', left: width * .42, top: 0, bottom: 0, width: width * .16, backgroundColor: preset.config.ribbonColor, opacity: .3 }} />
    <View style={{ position: 'absolute', left: 0, top: 0, borderLeftWidth: width / 2, borderRightWidth: width / 2, borderTopWidth: height * .55, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: preset.config.paperColor }} />
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', paddingTop: height * .15 }]}><WaxSeal color={preset.config.sealColor} size={width * .19} /></View>
  </View>;
}
