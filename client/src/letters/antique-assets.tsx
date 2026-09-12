import { Image, StyleSheet, View } from 'react-native';
import type { LetterPreset } from '@lantern-post/shared-types';

const textures = {
  parchment: require('../../assets/storybook/paper-texture-parchment.png'),
  linen: require('../../assets/storybook/paper-texture-linen.png'),
  vellum: require('../../assets/storybook/paper-texture-vellum.png'),
};
const borders = {
  floral: require('../../assets/storybook/paper-border-floral.png'),
  stars: require('../../assets/storybook/paper-border-stars.png'),
  royal: require('../../assets/storybook/paper-border-royal.png'),
  postmark: require('../../assets/storybook/paper-border-postmark.png'),
};

export function AntiquePaperLayers({ preset, border = true }: { preset: LetterPreset; border?: boolean }) {
  return <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Image source={require('../../assets/storybook/paper-silhouette.png')} style={[styles.layer, { tintColor: preset.config.paperColor }]} resizeMode="stretch" />
    <Image source={textures[preset.config.texture]} style={styles.layer} resizeMode="stretch" />
    {border && <Image source={borders[preset.config.motif]} style={[styles.layer, { tintColor: preset.config.ribbonColor, opacity: .82 }]} resizeMode="stretch" />}
  </View>;
}

export function PalaceCrest({ size = 62, color = '#A27D3B' }: { size?: number; color?: string }) {
  return <Image source={require('../../assets/storybook/palace-crest.png')} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" accessible={false} />;
}

const styles = StyleSheet.create({ layer: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' } });
