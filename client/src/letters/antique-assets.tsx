import { Image, StyleSheet, View } from 'react-native';
import type { LetterPreset } from '@lantern-post/shared-types';

export const paperTextures = {
  parchment: require('../../assets/storybook/paper-texture-parchment.png'),
  linen: require('../../assets/storybook/paper-texture-linen.png'),
  vellum: require('../../assets/storybook/paper-texture-vellum.png'),
};
export const paperBorders = {
  floral: require('../../assets/storybook/paper-border-floral.png'),
  stars: require('../../assets/storybook/paper-border-stars.png'),
  royal: require('../../assets/storybook/paper-border-royal.png'),
  postmark: require('../../assets/storybook/paper-border-postmark.png'),
  lace: require('../../assets/storybook/paper-border-lace.png'),
  peacock: require('../../assets/storybook/paper-border-peacock.png'),
  'rose-vine': require('../../assets/storybook/paper-border-rose-vine.png'),
  celestial: require('../../assets/storybook/paper-border-celestial.png'),
  regal: require('../../assets/storybook/paper-border-regal.png'),
  gilded: require('../../assets/storybook/paper-border-gilded.png'),
};

export function AntiquePaperLayers({ preset, border = true }: { preset: LetterPreset; border?: boolean }) {
  return <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Image source={require('../../assets/storybook/paper-silhouette.png')} style={styles.layer} resizeMode="stretch" tintColor={preset.config.paperColor} />
    <Image source={paperTextures[preset.config.texture]} style={styles.layer} resizeMode="stretch" />
    {border && <Image source={paperBorders[preset.config.motif]} style={[styles.layer, { opacity: .82 }]} resizeMode="stretch" tintColor={preset.config.ribbonColor} />}
  </View>;
}

export function PalaceCrest({ size = 62, color = '#A27D3B' }: { size?: number; color?: string }) {
  return <Image source={require('../../assets/storybook/palace-crest.png')} style={{ width: size, height: size }} resizeMode="contain" accessible={false} tintColor={color} />;
}

const styles = StyleSheet.create({ layer: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' } });
