import { useId } from 'react';
import type { CharacterKey } from '@lantern-post/shared-types';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from './svg-elements';
import { palettes } from '../src/storybook/palettes';
import { isRoyalCharacter, RoyalCharacterArt } from './royal-collection-art';

// Original vector companions. The same artwork is used in the gallery and home.
export function CharacterArt({ characterKey, size = 220 }: { characterKey: CharacterKey; size?: number }) {
  const id = useId().replace(/:/g, '');
  if (isRoyalCharacter(characterKey)) return <RoyalCharacterArt characterKey={characterKey} size={size} />;
  const p = palettes[characterKey];
  const rabbit = characterKey === 'rabbit-moon';
  const fox = characterKey === 'fox-lantern';
  const owl = characterKey === 'owl-scholar';
  const deer = characterKey === 'deer-dawn';
  const cat = characterKey === 'cat-astral';
  const swan = characterKey === 'swan-cloud';
  return <Svg width={size} height={size * 1.12} viewBox="0 0 240 270" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Defs>
      <LinearGradient id={`${id}coat`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={p.coat} /><Stop offset="1" stopColor={p.accent} /></LinearGradient>
      <LinearGradient id={`${id}fur`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor={p.furLight} /><Stop offset=".32" stopColor={p.fur} /><Stop offset="1" stopColor={p.fur} /></LinearGradient>
    </Defs>
    <Ellipse cx="120" cy="248" rx="67" ry="9" fill={p.shade} opacity=".24" />
    <G stroke="#72634D" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round">
      {fox && <><Path d="M163 166c59-5 67 49 41 68-21 15-47-1-54-20 28 11 37-9 14-21" fill={p.fur} /><Path d="M203 197c19 31-2 54-30 37 18-7 22-15 16-24z" fill={p.furLight} /></>}
      {cat && <Path d="M166 222c62 12 64-46 38-45-22 1-2 28-10 39-5 7-14 5-28 0" fill={p.fur} />}
      {rabbit && <Circle cx="175" cy="219" r="15" fill={p.furLight} />}
      <Ellipse cx="96" cy="239" rx="20" ry="10" fill={p.fur} /><Ellipse cx="146" cy="239" rx="20" ry="10" fill={p.fur} />
      <Path d="M96 141c-27 12-32 54-34 89 24 15 91 16 117-1-3-42-11-77-34-88z" fill={`url(#${id}coat)`} />
      <Path d="m97 147 22 84 25-84M120 161v78M73 223c28 8 63 11 96 0" fill="none" stroke={p.furLight} opacity=".65" />
      <Path d="m98 148 9 21 13-10 15 10 8-21" fill={p.furLight} /><Circle cx="120" cy="177" r="2" fill="#CFB36B" /><Circle cx="120" cy="195" r="2" fill="#CFB36B" />
      <Path d="M84 163c-15-3-28 25-19 40 6 7 20 1 21-9" fill={p.coat} /><Path d="M156 162c16-3 28 25 18 40-6 7-19 1-21-9" fill={p.coat} />
      {!swan && <>
        {rabbit && <><Path d="M89 93C57 43 70 1 85 14c15 15 20 52 21 72M131 85c-1-43 20-88 31-73 10 17-1 54-14 81" fill={`url(#${id}fur)`} /><Path d="M87 73c-11-24-14-48-7-47 9 6 15 37 16 50M139 74c2-27 12-51 16-50 4 10-4 37-9 52" fill="#D3B5B3" stroke="none" /></>}
        {(fox || cat) && <><Path d="M79 105 64 42c27 5 45 22 47 39M135 81c14-22 29-32 43-39l-10 68" fill={p.fur} /><Path d="m78 82-5-26 22 25m54 1 19-26-4 31" fill={fox ? '#6D5945' : '#C6A2AA'} stroke="none" /></>}
        {deer && <><Path d="M100 83C82 57 89 40 81 25m9 33L72 42m15 2 12-15M138 83c18-26 11-43 19-58m-9 33 20-16m-17 2-10-15" fill="none" stroke="#9D8256" strokeWidth="4" /><Path d="M91 96C54 100 50 68 65 73l35 15m43 8c37 4 41-28 26-23l-35 15" fill={p.fur} /><Path d="m71 80 17 10m75-10-17 10" stroke="#DCC1B0" strokeWidth="5" /></>}
        {owl ? <>
          <Path d="M66 83 67 53l30 17c14-7 34-7 48 0l29-17-1 29c22 68-8 85-53 86-47-1-73-20-54-85z" fill={`url(#${id}fur)`} />
          <Path d="M120 100C87 53 57 97 77 127c12 20 36 28 43 30 9-3 34-12 44-31 21-34-15-70-44-26z" fill={p.furLight} />
          <Circle cx="96" cy="109" r="19" fill="none" stroke="#9A7E4C" strokeWidth="2" /><Circle cx="144" cy="109" r="19" fill="none" stroke="#9A7E4C" strokeWidth="2" /><Path d="M115 108h10m-48-5-12-4m98 4 12-4" />
          <Path d="m115 125 5 11 6-11" fill="#C39950" />
        </> : <>
          <Path d={fox ? 'M74 80c22-12 69-12 91 0l14 40c-16 20-40 41-59 42-20-1-47-21-61-41z' : 'M72 94c6-33 89-35 97 0 19 53-7 72-49 72S52 146 72 94z'} fill={`url(#${id}fur)`} />
          <Path d={fox ? 'M62 113c27-5 43 5 58 26 17-22 32-31 57-25-11 26-35 45-57 48-25-3-46-22-58-49z' : 'M86 128c14-9 22 3 34 7 13-5 21-16 35-6 4 20-19 32-35 32-17 0-41-13-34-33z'} fill={p.furLight} stroke="none" />
          <Path d="m115 138 5 5 6-5c-3-3-8-3-11 0z" fill="#655140" /><Path d="M120 144v6m-6 1c3 3 9 3 12 0" fill="none" />
          {cat && <Path d="m77 133-24-4m25 11-26 3m110-10 24-4m-25 11 26 3" opacity=".65" />}
          {deer && <><Ellipse cx="99" cy="93" rx="3" ry="5" fill={p.furLight} stroke="none" /><Ellipse cx="141" cy="93" rx="3" ry="5" fill={p.furLight} stroke="none" /><Ellipse cx="120" cy="89" rx="3" ry="5" fill={p.furLight} stroke="none" /></>}
        </>}
        <Ellipse cx="96" cy={owl ? 110 : 117} rx="3.6" ry="5.1" fill="#483F36" /><Ellipse cx="144" cy={owl ? 110 : 117} rx="3.6" ry="5.1" fill="#483F36" />
        <Circle cx="97" cy={owl ? 108 : 115} r="1" fill="#FFF9E8" stroke="none" /><Circle cx="145" cy={owl ? 108 : 115} r="1" fill="#FFF9E8" stroke="none" />
        <Ellipse cx="82" cy="130" rx="7" ry="3" fill="#C59881" opacity=".4" stroke="none" /><Ellipse cx="158" cy="130" rx="7" ry="3" fill="#C59881" opacity=".4" stroke="none" />
      </>}
      {swan && <>
        <Path d="M109 164c32-19 18-40 6-59-17-25-17-47 1-57 22-11 44 7 42 28-2 22-30 19-18 47 9 22 25 29 16 42" fill={p.furLight} />
        <Path d="m156 67 21 14-23 5" fill="#CBAB6D" /><Circle cx="142" cy="67" r="3" fill="#50473C" />
        <Path d="M78 166c-24-10-46-6-41 14 5 21 32 46 74 42-13-12-21-35-33-56zM158 167c24-9 46-6 41 15-5 20-21 31-42 35" fill={p.furLight} />
        <Path d="M49 176c4 12 15 21 27 29m-13-35c1 14 10 25 22 33m-5-23c3 13 11 22 21 29m70-30c-3 14-6 18-14 25" fill="none" stroke="#BDBAA2" />
      </>}
      <Path d="M78 181 163 227" stroke="#C1A477" strokeWidth="9" /><Rect x="136" y="201" width="37" height="28" rx="4" fill="#B79465" /><Path d="m137 203 17 15 18-15" fill="none" />
      {fox && <><Path d="M62 190v14m-7 5 8-5 8 5m-19 2h23l-2 28H54z" fill="#F5D28C" /><Path d="M53 214h21m-15 1v19m9-19v19M52 240h23" /><Path d="M63 221c-8 9-4 14 1 12 4-3-1-8-1-12z" fill="#CD934F" stroke="none" /></>}
      {rabbit && <><Path d="M58 213c16-11 10-25 19-30" fill="none" stroke="#7C8D69" /><Path d="M75 191c-16-3-11-13-4-9 0-11 12-10 10 0 10-3 14 7 2 11" fill="#EEE4F2" /></>}
      {owl && <><Path d="m45 195 36-8 10 39-36 8z" fill="#B39973" /><Path d="m49 198 28-6 8 30-28 7z" fill="#F0DEC0" /><Path d="m58 206 16-4m-14 10 15-3m-13 10 14-3" stroke="#A18554" /></>}
      {deer && <><Path d="M66 208v-20m0 12-9-6m9 0 9-7" stroke="#7A895F" /><Circle cx="66" cy="183" r="9" fill="#D3A7A1" /><Circle cx="66" cy="183" r="3" fill="#EBD1B6" /></>}
      {cat && <><Path d="m61 182 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#E8D08E" /><Path d="M115 91a8 8 0 1 0 13-10 10 10 0 0 1-13 10z" fill="#EAD595" stroke="none" /></>}
      {swan && <><Path d="m109 49-5-14 13 6 6-14 7 13 12-7-3 15z" fill="#D5BA77" /><Circle cx="122" cy="39" r="2" fill="#FFF5CA" /></>}
      <G opacity=".16" fill="none"><Path d="m84 182-8 32m22-12-6 30m61-59 9 27m-13-3 8 21M80 101l-3 8m7-15-3 8M155 95l4 9m-6 4 4 10" /></G>
    </G>
  </Svg>;
}
