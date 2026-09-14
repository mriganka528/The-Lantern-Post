import { Image } from 'react-native';
import { gold } from './theme';

export function LanternMark({ size = 34, color = gold }: { size?: number; color?: string }) {
  return <Image source={require('../../assets/storybook/lantern.png')} style={{ width: size, height: size * 1.2 }} resizeMode="contain" accessible={false} tintColor={color} />;
}
export function Flourish({ width = 180, color = gold }: { width?: number; color?: string }) {
  return <Image source={require('../../assets/storybook/flourish.png')} style={{ width, height: 24 }} resizeMode="contain" accessible={false} tintColor={color} />;
}
const icons = {
  star: require('../../assets/storybook/icon-star.png'), key: require('../../assets/storybook/icon-key.png'),
  letter: require('../../assets/storybook/icon-letter.png'), gate: require('../../assets/storybook/icon-gate.png'),
  moon: require('../../assets/storybook/icon-moon.png'), arrow: require('../../assets/storybook/icon-arrow.png'),
  close: require('../../assets/storybook/icon-close.png'),
  bell: require('../../assets/storybook/icon-bell.png'),
};
export function StoryIcon({ kind, size = 24, color = gold }: { kind: keyof typeof icons; size?: number; color?: string }) {
  return <Image source={icons[kind]} style={{ width: size, height: size }} resizeMode="contain" accessible={false} tintColor={color} />;
}
