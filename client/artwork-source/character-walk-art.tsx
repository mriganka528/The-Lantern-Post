import type { CharacterKey } from '@lantern-post/shared-types';
import Svg, { Ellipse, G, Path, Rect } from './svg-elements';
import { palettes } from '../src/storybook/palettes';
import { isRoyalCharacter, RoyalCharacterArt } from './royal-collection-art';

export function CharacterWalkArt({ characterKey, part }: { characterKey: CharacterKey; part: 'body' | 'left-foot' | 'right-foot' }) {
  const p = palettes[characterKey];
  if (isRoyalCharacter(characterKey) && part === 'body') return <RoyalCharacterArt characterKey={characterKey} back bodyOnly />;
  const rabbit = characterKey === 'rabbit-moon';
  const deer = characterKey === 'deer-dawn';
  const swan = characterKey === 'swan-cloud';
  return <Svg width={320} height={360} viewBox="0 0 240 270">
    {part !== 'body' ? <G stroke="#8D7657" strokeWidth="1.2"><Path d={part === 'left-foot' ? 'M82 214h27l3 22c-1 14-34 14-36 2z' : 'M131 214h27l8 24c-2 12-34 12-36-2z'} fill={swan ? '#D4BA82' : p.fur} /></G> : <G stroke="#887351" strokeWidth="1.3" strokeLinejoin="round">
      {characterKey === 'fox-lantern' && <><Path d="M156 180c45-10 72 7 59 35-14 33-53 21-63-3" fill={p.fur} /><Path d="M202 185c30 22 6 55-23 46 11-11 16-20 11-31z" fill={p.furLight} /></>}
      {characterKey === 'cat-astral' && <Path d="M162 218c57 15 65-39 37-43-25-4-13 20-3 16 2 17-11 25-30 21" fill={p.fur} />}
      <Path d="M94 142c-34 14-33 49-34 87 28 17 94 18 122 0-6-47-8-73-37-87z" fill={p.coat} />
      <Path d="M96 145c-9 41-10 58-13 86m60-86c9 41 10 58 13 86M70 224c28 8 65 10 102 0" fill="none" stroke={p.furLight} opacity=".5" />
      <Path d="M87 156c-20-11-29 26-24 36m95-36c20-10 29 26 22 38" fill="none" stroke={p.coat} strokeWidth="14" />
      {rabbit && <><Path d="M91 101C55 42 69 5 84 15c19 15 22 54 23 82m26 0c-3-45 19-94 31-80 10 15-2 53-19 84" fill={p.fur} /><Ellipse cx="123" cy="217" rx="15" ry="12" fill={p.furLight} /></>}
      {deer && <Path d="M101 94c-15-28-9-44-18-66m4 15-17-7m21 26 12-14M139 94c15-28 9-44 18-66m-4 15 17-7m-21 26-12-14" fill="none" strokeWidth="4" />}
      {swan ? <><Path d="M105 153c42-30 18-58 5-79-13-22 8-47 27-29 17 19-2 23-9 37-8 21 40 49 20 74" fill={p.furLight} /><Path d="M96 170c-33-20-50-6-30 27 9 17 28 22 38 22m43-48c33-20 50-6 30 27-9 17-24 21-32 22" fill={p.furLight} /><Path d="m113 47-5-13 12 5 8-14 7 14 12-7-5 14" fill="#D3B877" /></> : <>
        {['fox-lantern', 'cat-astral', 'owl-scholar'].includes(characterKey) && <Path d="m73 109-7-61 41 31m27 0 41-31-7 61" fill={p.fur} />}
        {deer && <Path d="M93 91C58 70 47 81 80 105m67-14c35-21 46-10 13 14" fill={p.fur} />}
        <Path d="M72 94c9-29 87-29 96 0 14 53-7 73-48 74-43-2-61-21-48-74z" fill={p.fur} />
        <Path d="M104 90c-7 16-3 35-11 45m24-49c-5 18 0 37-6 54m23-51c5 18 0 37 6 54" fill="none" stroke={p.furLight} opacity=".25" />
      </>}
      <Path d="m80 163 81 62" stroke="#D6BB85" strokeWidth="8" /><Rect x="148" y="204" width="36" height="28" rx="4" fill="#B89A6C" /><Path d="m149 207 17 10 17-10" fill="none" />
      {characterKey === 'fox-lantern' && <><Path d="M62 190v21m-10 0h21l-2 27H54z" fill="#EDCF8D" /><Path d="M60 216v17m7-17v17" /></>}
    </G>}
  </Svg>;
}
