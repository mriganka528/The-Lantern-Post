import type { CharacterKey } from '@lantern-post/shared-types';
import Svg, { Circle, Ellipse, G, Path } from './svg-elements';
import { CharacterArt } from './character-art';
import { palettes } from '../src/storybook/palettes';

export function DeskCompanionArt({ characterKey }: { characterKey: CharacterKey }) {
  const p = palettes[characterKey];
  return <Svg width={340} height={300} viewBox="0 0 340 300">
    <Ellipse cx="170" cy="284" rx="149" ry="11" fill="#4F3829" opacity=".15" />
    <G stroke="#A08452" strokeWidth="1.4">
      <Path d="M90 221V95c0-99 160-99 160 0v126" fill={p.wall} /><Path d="M99 207V96c0-86 142-86 142 0v111" fill={p.roof} />
      <Path d="M106 97c0-78 128-78 128 0" fill="none" stroke="#E1CA8C" /><Circle cx="170" cy="34" r="5" fill="#C7AD6D" />
      <Path d="m144 44 26-24 26 24m-26-18v18" fill="none" />
    </G>
    <G transform="translate(57 1)"><CharacterArt characterKey={characterKey} size={226} /></G>
    <G stroke="#8D6B40" strokeWidth="1.5" strokeLinejoin="round">
      <Path d="m43 204-6 77h12l13-74m235-3 6 77h-12l-13-74" fill="#81613E" />
      <Path d="M40 176h260l21 28H19z" fill="#B99B65" />
      <Path d="M21 204h298v13H21z" fill="#84603C" />
      <Path d="M59 217h222v32H59z" fill="#A4814F" /><Path d="M68 223h90v19H68zm114 0h90v19h-90z" fill="none" stroke="#D6BB7B" />
      <Circle cx="113" cy="232" r="3" fill="#E4C784" /><Circle cx="227" cy="232" r="3" fill="#E4C784" />
      <Path d="m128 180 66-7 24 24-77 2z" fill="#FFF0CD" /><Path d="m148 185 42-3m-38 9 39-3" fill="none" opacity=".5" />
      <Path d="M251 181v-9h16v9l5 12h-26z" fill="#4D534E" /><Path d="M48 181v-15h31v15" fill={p.coat} />
      <Path d="M59 169v-48h10v48" fill="#F1DEAD" /><Path d="M64 123c-13-8-5-24 0-30 6 12 12 21 0 30" fill="#F4CC71" />
      <Path d="M163 212h14v43l-7 9-7-9z" fill={p.accent} /><Circle cx="170" cy="227" r="5" fill="#EACF8C" />
    </G>
  </Svg>;
}
export function DeskQuillArt() {
  return <Svg width={55} height={100} viewBox="0 0 55 100"><Path d="M6 96 39 17" fill="none" stroke="#8E7549" strokeWidth="2" /><Path d="M15 70C1 39 25 10 48 2c1 24-5 49-33 68" fill="#FBF2D4" stroke="#AD945E" strokeWidth="1.5" /><Path d="m15 68 27-56m-17 33-12-5m18-8-12-4m0 27 14-1" fill="none" stroke="#C8B582" /></Svg>;
}
