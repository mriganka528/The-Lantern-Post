import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from './svg-elements';

export function DoorArt({ side }: { side: 'left' | 'right' }) {
  return <Svg width={180} height={450} viewBox="0 0 180 450">
    <Defs><LinearGradient id={`door-${side}`} x2="1" y2="0"><Stop stopColor="#E3D1AA" /><Stop offset=".4" stopColor="#F3E6C8" /><Stop offset="1" stopColor="#D3BA86" /></LinearGradient></Defs>
    <G transform={side === 'right' ? 'translate(180 0) scale(-1 1)' : undefined} stroke="#A1844F" strokeWidth="1.5" fill="none">
      <Path d="M0 450V180A180 180 0 0 1 180 0v450z" fill={`url(#door-${side})`} />
      <Path d="M10 439V180A170 170 0 0 1 170 11v428zM19 430V183A160 160 0 0 1 161 22v408z" />
      <Path d="M33 226v-43c0-67 47-124 113-140v183zM33 245h113v170H33z" fill="#DAC398" fillOpacity=".25" />
      <Path d="M43 214v-31c0-56 39-105 93-124v155zM43 255h93v150H43z" strokeWidth=".8" />
      <Path d="M71 159c-18-28 13-48 23-27 7 15-9 40-26 20-16-19 15-56 45-38M68 151c-12 19-5 42 18 43 31 0 31-28 11-22-12 4-11 26 12 27M111 113c-14-36 4-49 20-49M54 273c31 19 61 20 72 0M54 385c31-19 61-20 72 0" />
      <Path d="m90 296 8 24 24 8-24 8-8 24-8-24-24-8 24-8z" fill="#C3A361" fillOpacity=".3" />
      <Circle cx="90" cy="328" r="5" fill="#E9D6A5" />
      <Path d="M166 252v34" strokeWidth="5" stroke="#8C6B37" /><Circle cx="166" cy="253" r="5" fill="#D6B971" /><Circle cx="166" cy="286" r="5" fill="#D6B971" />
      <Path d="M31 191h116M90 70v154M20 438h142M158 34v383" strokeWidth=".7" opacity=".45" />
    </G>
  </Svg>;
}
