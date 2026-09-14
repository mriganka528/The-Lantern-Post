import Svg, { Circle, G, Path, Rect } from './svg-elements';
const gold = '#A38449';

export function LanternMark({ size = 34, color = gold }: { size?: number; color?: string }) {
  return <Svg width={size} height={size * 1.2} viewBox="0 0 40 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <G stroke={color} strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 8V5a3 3 0 0 1 6 0v3M13 13l7-5 7 5M11 15h18l-2 23H13zM9 15h22M12 39h16M16 43h8M16 18v17M24 18v17" />
      <Path d="M20 22c-1 4-5 5-3 9 1 3 5 3 6 0 1-3-2-5-3-9z" fill={color} opacity=".6" />
      <Path d="M3 24H0M40 24h-3M5 8l2 3M33 11l2-3M20 46v2" />
    </G>
  </Svg>;
}

export function Flourish({ width = 180, color = gold }: { width?: number; color?: string }) {
  return <Svg width={width} height={24} viewBox="0 0 180 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <G fill="none" stroke={color} strokeWidth=".8">
      <Path d="M0 12h56c16 0 14-12 5-8-9 4 4 15 17 8M180 12h-56c-16 0-14-12-5-8 9 4-4 15-17 8" />
      <Path d="m90 5 5 7-5 7-5-7zM80 12h-5M100 12h5" />
      <Circle cx="12" cy="12" r="2" /><Circle cx="168" cy="12" r="2" />
    </G>
  </Svg>;
}

export function StoryIcon({ kind, size = 24, color = gold }: { kind: 'star' | 'key' | 'letter' | 'gate' | 'moon' | 'arrow' | 'close' | 'bell'; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <G fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {kind === 'star' && <Path d="m16 2 3.5 10.5L30 16l-10.5 3.5L16 30l-3.5-10.5L2 16l10.5-3.5z" />}
      {kind === 'key' && <><Circle cx="10" cy="10" r="6" /><Circle cx="10" cy="10" r="2" /><Path d="m14 14 13 13m-4-4 4-4m-8 0 4-4" /></>}
      {kind === 'letter' && <><Rect x="3" y="7" width="26" height="19" rx="1" /><Path d="m3 8 13 11L29 8M3 25l9-9m8 0 9 9" /><Circle cx="16" cy="18" r="3" fill={color} /></>}
      {kind === 'gate' && <><Path d="M5 28V13a11 11 0 0 1 22 0v15M9 28V13a7 7 0 0 1 14 0v15M16 7v21M3 28h26" /><Circle cx="13" cy="20" r="1" /><Circle cx="19" cy="20" r="1" /></>}
      {kind === 'moon' && <><Path d="M24 23A12 12 0 1 1 15 3a10 10 0 0 0 9 20z" /><Path d="m25 4 1 3 3 1-3 1-1 3-1-3-3-1 3-1z" /></>}
      {kind === 'arrow' && <Path d="M5 16h22m-7-7 7 7-7 7" />}
      {kind === 'close' && <Path d="m8 8 16 16M24 8 8 24" />}
      {kind === 'bell' && <><Path d="M13 6V4a3 3 0 0 1 6 0v2M7 21c3-3 1-10 5-13 2-2 6-2 8 0 4 3 2 10 5 13l2 3H5zM7 26h18M12 27a4 4 0 0 0 8 0M10 20h12M12 11q4-3 8 0" /><Path d="m16 13 1 2 2 1-2 1-1 2-1-2-2-1 2-1z" fill={color} opacity=".55" /></>}
    </G>
  </Svg>;
}
