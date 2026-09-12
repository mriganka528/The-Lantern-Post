import { Animated, Image, StyleSheet, View } from 'react-native';
import type { LetterPreset } from '@lantern-post/shared-types';
import { WaxSeal } from './stationery';

export const BURN_RITUAL_DURATION_MS = 11_000;
const WIDTH = 300;
const HEIGHT = 210;
const COLUMNS = 30;

// Each clip moves up while its paper moves down by the same amount. That
// reveals a receding burn edge without shrinking/stretching the letter and
// keeps all movement on React Native's transform/opacity animation driver.
export function ProgressiveBurnLetter({ progress, preset }: { progress: Animated.Value; preset: LetterPreset | null }) {
  return <Animated.View testID="burn-envelope" pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.letter, {
    opacity: progress.interpolate({ inputRange: [0, .87, .95, 1], outputRange: [1, 1, 0, 0] }),
    transform: [{ translateY: progress.interpolate({ inputRange: [0, .16, 1], outputRange: [0, 110, 110] }) }, { rotate: progress.interpolate({ inputRange: [0, .16, .65, 1], outputRange: ['-4deg', '1deg', '-3deg', '-6deg'] }) }],
  }]}>
    <View style={styles.sheetClip}>
      {Array.from({ length: COLUMNS }, (_, i) => {
        const columnWidth = WIDTH / COLUMNS;
        const ignition = .17 + Math.sin(i * .55) * .014 + i % 3 * .009;
        const consumed = .845 + Math.sin(i * .35) * .023 + i % 4 * .006;
        const loss = progress.interpolate({ inputRange: [0, ignition, consumed, 1], outputRange: [0, 0, HEIGHT + 22, HEIGHT + 22] });
        const scorch = progress.interpolate({ inputRange: [0, ignition, ignition + .017, consumed - .02, consumed, 1], outputRange: [0, 0, 1, 1, 0, 0] });
        // Overlap the opaque paper slightly so rotated clips do not leave
        // antialiasing seams when the entire realm is scaled down on a phone.
        return <Animated.View key={i} testID={`paper-burn-column-${i}`} style={{ position: 'absolute', left: i * columnWidth, top: 0, width: columnWidth + 2, height: HEIGHT, overflow: 'hidden', transform: [{ translateY: Animated.multiply(loss, -1) }] }}>
          <Animated.View style={{ position: 'absolute', left: -i * columnWidth, top: 0, width: WIDTH, height: HEIGHT, transform: [{ translateY: loss }] }}>
            <Image source={require('../../assets/storybook/paper-silhouette.png')} style={[styles.paperLayer, { tintColor: preset?.config.paperColor ?? '#F0DDB5' }]} resizeMode="stretch" accessible={false} />
            <Image source={require('../../assets/storybook/paper-texture-parchment.png')} style={[styles.paperLayer, { opacity: .7 }]} resizeMode="stretch" accessible={false} />
            <Image source={require('../../assets/storybook/ritual-engraving.png')} style={[styles.paperLayer, { tintColor: preset?.config.inkColor ?? '#62472C', opacity: .74 }]} resizeMode="stretch" accessible={false} />
            <View style={{ position: 'absolute', right: 42, top: 6, bottom: 5, width: 13, backgroundColor: preset?.config.ribbonColor ?? '#A88E5C', opacity: .42 }} />
          </Animated.View>
          <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 12, backgroundColor: '#30241E', opacity: scorch }} />
          <Animated.Image source={require('../../assets/storybook/charred-paper-edge.png')} style={{ position: 'absolute', width: WIDTH, height: 22, left: -i * columnWidth, top: HEIGHT - 22,
            opacity: scorch,
            transformOrigin: 'bottom center', transform: [{ perspective: 250 }, { rotateX: progress.interpolate({ inputRange: [0, ignition, consumed, 1], outputRange: ['0deg', '0deg', '37deg', '37deg'] }) }],
          }} resizeMode="stretch" accessible={false} />
        </Animated.View>;
      })}
    </View>
    <Animated.View style={{ position: 'absolute', right: 25, top: 112, opacity: progress.interpolate({ inputRange: [0, .3, .47, 1], outputRange: [1, 1, 0, 0] }), transform: [{ translateY: progress.interpolate({ inputRange: [0, .3, .48, 1], outputRange: [0, 0, 32, 32] }) }, { rotate: progress.interpolate({ inputRange: [0, .3, .48, 1], outputRange: ['0deg', '0deg', '34deg', '34deg'] }) }] }}>
      <WaxSeal color={preset?.config.sealColor ?? '#854B39'} size={44} />
    </Animated.View>
  </Animated.View>;
}

const styles = StyleSheet.create({
  letter: { position: 'absolute', left: 650, top: 515, width: WIDTH, height: HEIGHT },
  sheetClip: { width: WIDTH, height: HEIGHT, overflow: 'hidden' },
  paperLayer: { position: 'absolute', width: WIDTH, height: HEIGHT },
});
