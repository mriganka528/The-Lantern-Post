import type { CharacterKey, StationeryConfig } from '@lantern-post/shared-types';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from './svg-elements';
import { palettes } from '../src/storybook/palettes';
export const royalCharacterKeys = ['unicorn-aurelia', 'peacock-seraph', 'lion-solstice', 'dragon-jade'] as const;
export type RoyalCharacterKey = typeof royalCharacterKeys[number];
export const isRoyalCharacter = (key: CharacterKey): key is RoyalCharacterKey => (royalCharacterKeys as readonly string[]).includes(key);
const starPath = (x: number, y: number, r = 5) => `M${x} ${y-r}l${r*.3} ${r*.7} ${r*.7} ${r*.3}-${r*.7} ${r*.3}-${r*.3} ${r*.7}-${r*.3}-${r*.7}-${r*.7}-${r*.3} ${r*.7}-${r*.3}z`;

export function RoyalCharacterArt({ characterKey, size = 320, back = false, bodyOnly = false }: { characterKey: RoyalCharacterKey; size?: number; back?: boolean; bodyOnly?: boolean }) {
  const p = palettes[characterKey]; const unicorn = characterKey === 'unicorn-aurelia'; const peacock = characterKey === 'peacock-seraph'; const lion = characterKey === 'lion-solstice'; const dragon = characterKey === 'dragon-jade';
  const id = `royal-${characterKey}`;
  return <Svg width={size} height={size * 1.12} viewBox="0 0 240 270"><Defs><LinearGradient id={id} x2="1" y2="1"><Stop stopColor={p.furLight} /><Stop offset=".4" stopColor={p.coat} /><Stop offset="1" stopColor={p.accent} /></LinearGradient></Defs>
    {!bodyOnly && <><Ellipse cx="120" cy="252" rx="74" ry="8" fill={p.shade} opacity=".25" /><Circle cx="120" cy="117" r="91" fill="none" stroke="#CDB881" opacity=".45" /><Circle cx="120" cy="117" r="96" fill="none" stroke="#CDB881" opacity=".18" /></>}
    <G stroke="#8F7B58" strokeWidth="1.15" strokeLinejoin="round" strokeLinecap="round">
      {peacock && <G transform="translate(120 165)">{Array.from({ length: 9 }, (_, i) => <G key={i} transform={`rotate(${-76 + i * 19})`}><Path d="M0 0C-36-55-28-117 0-142c28 25 36 87 0 142z" fill={i % 2 ? '#749B91' : '#588382'} /><Path d="M0-5v-117" fill="none" stroke="#CEBD82" /><Ellipse cy="-98" rx="12" ry="19" fill="#C8B775" /><Ellipse cy="-98" rx="8" ry="12" fill="#487C88" /><Ellipse cy="-99" rx="4" ry="7" fill="#D5E4CE" /></G>)}</G>}
      {dragon && <><Path d="M79 153C21 148 7 113 17 83l29 27 11-40 21 42 13 34M161 153c58-5 72-40 62-70l-29 27-11-40-21 42-13 34" fill="#BBCEB2" /><Path d="M80 148 28 99m51 47-21-66m103 68 51-49m-52 47 21-66" fill="none" stroke="#8AA78E" /><Path d="M170 200c35-19 55-8 45 17-11 26-34 27-54 16" fill={p.fur} /><Path d="m207 216 10-5-3 12-10 1" fill="#D9CA8B" /></>}
      {unicorn && <><Path d="M160 178c63-11 41 67 10 65 14-19-4-37-21-33" fill="#C7B5CC" /><Path d="M175 186c20 20 15 45 4 52" fill="none" stroke="#E8DCCF" strokeWidth="4" /></>}
      {lion && <Path d="M170 218c39 13 48-9 38-27m-5-5c-3-15 19-13 16 1-2 12-14 15-16-1z" fill={p.fur} strokeWidth="5" />}
      {!bodyOnly && <><Ellipse cx="91" cy="242" rx="19" ry="10" fill={peacock ? '#D4BE82' : p.fur} /><Ellipse cx="148" cy="242" rx="19" ry="10" fill={peacock ? '#D4BE82' : p.fur} /></>}
      <Path d="M91 144c-32 14-36 58-38 88 29 24 104 24 133-1-5-45-10-76-41-87z" fill={`url(#${id})`} />
      <Path d="M98 145c-14 26-9 55-22 87m66-88c13 29 8 62 22 88M61 228c37 17 85 17 117 0" fill="none" stroke="#EFDFB3" strokeWidth="2.5" />
      <Path d="M91 148q29 29 57 0l-10 30-18-11-18 11z" fill={p.furLight} /><Path d="M120 169v65" stroke="#E5D199" />
      <G fill="#F3DEAB" stroke="none">{[186, 202, 219].map(y => <Circle key={y} cx="120" cy={y} r="2.1" />)}{[[77,202],[91,218],[146,219],[163,199]].map(([x,y]) => <Path key={x} d={starPath(x!,y!,4)} />)}</G>
      <Path d="M82 165c-22-5-28 27-19 39m95-39c22-5 28 27 19 39" fill="none" stroke={p.coat} strokeWidth="14" />
      <Path d="M68 193h14m75 0h16" stroke="#E3CF9D" strokeWidth="3" />
      {lion && <Path d={Array.from({ length: 36 }, (_, i) => { const a = i * Math.PI / 18; const r = i % 2 ? 51 : 60; return `${i ? 'L' : 'M'}${120 + Math.cos(a) * r} ${99 + Math.sin(a) * r}`; }).join('') + 'Z'} fill="#BC945A" stroke="#A7834E" />}
      {unicorn && <><Path d="M85 90 71 45l29 21m40 0 27-24-7 55" fill={p.fur} /><Path d="m110 66 15-60 14 65" fill="#D9BF84" /><Path d="m119 29 12 5m-16 8 18 5m-21 8 23 6" fill="none" stroke="#FFF0B9" strokeWidth="2" /><Path d="M150 64c41 10 46 52 23 81l-14-11c22-31-12-38-19-60" fill="#BAA6C7" /></>}
      {dragon && <><Path d="M85 80C56 67 67 40 79 31c-4 21 2 29 17 33m49 16c29-13 18-40 6-49 4 21-2 29-17 33" fill="#DDCE96" /><Path d="m72 96-21-16 8 32m108-16 20-16-8 32" fill={p.fur} /></>}
      {peacock ? <><Path d="M95 146c27-27 3-48 5-68 1-23 32-30 43-13 13 22-13 26-7 44 5 16 21 26 11 42" fill={p.fur} />{!back && <><Path d="m143 74 20 9-20 8" fill="#D8BC76" /><Circle cx="133" cy="76" r="3" fill="#293D41" /><Path d="m125 83 8 5" stroke="#D9E8D2" /></>}<Path d="M113 59 103 36m17 19 0-29m6 29 13-21" fill="none" stroke="#B59D5F" />{[[103,33],[120,24],[140,31]].map(([x,y]) => <Ellipse key={x} cx={x} cy={y} rx="4" ry="6" fill="#D8C28A" />)}</> : <>
        <Path d="M78 90c10-33 76-38 88 0 15 43-9 68-45 70-36-1-60-21-43-70z" fill={p.fur} />
        {back ? <><Path d="M96 83c-13 32 9 37 1 62m20-71c-9 26 6 44-1 72m23-67c10 29-6 39 4 66" fill="none" stroke={p.furLight} opacity=".6" />{unicorn && <Path d="M111 73c-10 34 18 44 1 80 26-17 9-40 20-78" fill="#CAB7D1" />}</> : <>
          <Ellipse cx="120" cy="133" rx="27" ry="19" fill={p.furLight} stroke="none" /><Ellipse cx="98" cy="108" rx="3.3" ry="4.8" fill="#4A4036" /><Ellipse cx="142" cy="108" rx="3.3" ry="4.8" fill="#4A4036" /><Circle cx="99" cy="106" r="1" fill="#FFF8DA" stroke="none" /><Circle cx="143" cy="106" r="1" fill="#FFF8DA" stroke="none" />
          <Path d="m115 130 5 5 5-5m-5 5v7m-6 2q6 5 12 0" fill="none" /><Path d="m84 118 7 1m58-1 7-1" stroke="#BE9691" strokeWidth="3" opacity=".55" />
          {dragon && <><Path d="m117 86 4-7 4 7-4 7z" fill="#D8C58C" /><Circle cx="91" cy="127" r="2" fill="#8BA08C" /><Circle cx="151" cy="127" r="2" fill="#8BA08C" /></>}
        </>}
      </>}
      {!unicorn && !peacock && <><Path d="m97 68-4-20 17 10 10-26 11 26 18-10-5 20z" fill="#D3B677" /><Path d="M100 73h40" stroke="#F3E1AA" strokeWidth="3" /><Circle cx="120" cy="58" r="4" fill={dragon ? '#688D7B' : '#A77151'} /></>}
      <Path d="m80 173 80 53" stroke="#D9C391" strokeWidth="8" /><Rect x="144" y="203" width="39" height="30" rx="5" fill="#A7895B" /><Path d="m146 207 17 12 18-12" fill="none" stroke="#F0DBA4" /><Circle cx="163" cy="220" r="4" fill="#C8AE71" />
      {unicorn && <><Path d="M65 202 49 157" stroke="#C9AB69" strokeWidth="3" /><Path d={starPath(47,150,12)} fill="#EFDBA7" /><Circle cx="47" cy="150" r="3" fill="#C9B7D3" /></>}
      {lion && <><Circle cx="120" cy="167" r="10" fill="#D9BA77" /><Path d={starPath(120,167,7)} fill="#F4E3B7" /></>}
      {dragon && <><Path d="M61 194v16m-11 3 11-5 11 5-3 27H54z" fill="#D7DBA4" /><Path d="M58 216v18m7-18v18" fill="none" /><Circle cx="61" cy="225" r="3" fill="#FFF0B3" /></>}
      {peacock && <><Path d="m54 188 23 4-6 29-23-4z" fill="#D9C387" /><Path d="m52 199 19 4m-18 4 15 3" stroke="#F7E8BF" /></>}
    </G>
  </Svg>;
}

export function RoyalPalaceDetails({ characterKey }: { characterKey: RoyalCharacterKey }) {
  const p = palettes[characterKey]; const jade = characterKey === 'dragon-jade'; const peacock = characterKey === 'peacock-seraph';
  return <G stroke="#B39A60" strokeWidth="1.1" fill="none">
    <Path d="M449 476V263c0-197 302-197 302 0v213M442 479V263c0-206 316-206 316 0v216" />
    {Array.from({ length: 19 }, (_, i) => { const a = Math.PI + i * Math.PI / 18; return <Circle key={i} cx={600 + Math.cos(a) * 144} cy={267 + Math.sin(a) * 172} r="3.5" fill="#F8E9BD" />; })}
    <Path d="m569 114-8-26 22 10 17-32 17 32 22-10-8 26z" fill="#D3BA7E" /><Circle cx="600" cy="96" r="5" fill={p.roof} /><Path d="M569 120h62" strokeWidth="3" />
    {[399, 784].map(x => <G key={x}><Path d={`M${x} 308v159m8-159v159m8-159v159`} stroke="#EEE1B8" strokeWidth="2" />{[326, 366, 406, 448].map(y => <Path key={y} d={starPath(x+8,y,8)} fill={p.shade} />)}</G>)}
    {[320, 880].map(x => <G key={x}><Path d={`M${x} 262v49`} /><Path d={`m${x-9} 315 9-7 9 7-3 22h-12z`} fill="#E7D9A8" /><Circle cx={x} cy="325" r="3" fill="#FFF3C3" /></G>)}
    {peacock ? <G transform="translate(600 193)">{[-60,-30,0,30,60].map(a => <G key={a} transform={`rotate(${a})`}><Path d="M0 0q-18-37 0-62 18 25 0 62z" fill={p.roof} /><Ellipse cy="-39" rx="5" ry="9" fill="#E4D29E" /></G>)}</G> : <G><Circle cx="600" cy="187" r="21" fill={p.sky} /><Circle cx="600" cy="187" r="27" />{Array.from({length:12},(_,i)=><Path key={i} d="M600 150v8" transform={`rotate(${i*30} 600 187)`} />)}</G>}
    {jade && <G strokeWidth="3"><Path d="M250 325q71 20 144-12M806 313q73 32 144 12M351 277q90 25 118-8m262 0q28 33 118 8" stroke={p.roof} /><Path d="M258 336q68 13 130-9m424 0q62 22 130 9" stroke="#D9C08B" /></G>}
    <Path d="M389 294q54 29 78 0m264 0q24 29 78 0M454 481h292" stroke="#D1B875" />
  </G>;
}

export function RoyalStationeryArt({ motif }: { motif: StationeryConfig['motif'] }) {
  const floral = motif === 'rose-vine'; const celestial = motif === 'celestial'; const fan = motif === 'peacock';
  return <Svg width={500} height={700} viewBox="0 0 500 700"><G fill="none" stroke="#8A7652" strokeWidth="1.3">
    <Rect x="20" y="20" width="460" height="660" rx="19" /><Rect x="27" y="27" width="446" height="646" rx="15" /><Rect x="34" y="34" width="432" height="632" rx="12" opacity=".55" />
    {[false,true].map(right => <G key={String(right)} transform={right ? 'translate(500 0) scale(-1 1)' : undefined}>
      {Array.from({length:18},(_,i)=><G key={i} transform={`translate(24 ${61+i*33})`}>
        {motif === 'lace' ? <><Path d="M0-15q28 15 0 30m4-24q17 9 0 18" /><Circle cx="10" r="2.2" fill="#8A7652" /></> : <><Path d="M0-15c25 4 25 26 0 30m3-21q12-9 15 2-9 1-8 7" /><Ellipse cx="8" cy="-7" rx="6" ry="2" transform="rotate(-30 8 -7)" /></>}
      </G>)}
      {[false,true].map(bottom => <G key={String(bottom)} transform={bottom ? 'translate(0 700) scale(1 -1)' : undefined}>
        <Path d="M42 105V59q0-17 17-17h77M49 89V63q0-14 14-14h42" strokeWidth="2" />
        {fan ? <G transform="translate(68 67)">{[-60,-30,0,30,60].map(a=><G key={a} transform={`rotate(${a})`}><Path d="M0 0q-15-25 0-42 15 17 0 42z" /><Ellipse cy="-27" rx="4" ry="6" /></G>)}</G> : floral ? <G transform="translate(77 76)"><Path d="M0-14c15-13 24 1 16 10 19 11 3 23-8 15-10 20-26 0-15-9-21-3-11-23 7-16z" /><Circle r="5" /><Path d="M-4 14q-2 20 24 32m-19-20q-24-7-26 8 17 6 24-2" /></G> : celestial ? <><Circle cx="79" cy="77" r="18" /><Circle cx="79" cy="77" r="24" /><Path d="M85 61c-21 7-14 27 0 30-26 1-27-28 0-30z" /><Path d={starPath(111,98,9)} /></> : <><Path d="M49 58c9 20 41-12 48 15s-27 21-27 4c-12 13-2 30 18 28m-25-55c27 9-9 41 15 48" /><Path d={starPath(112,63,9)} /></>}
      </G>)}
    </G>)}
    <G transform="translate(250 44)">{motif === 'regal' ? <><Path d="m-27 5-4-21 20 10L0-26 11-6l20-10-4 21z" /><Circle cy="-10" r="4" /><Path d="M-28 11h56" strokeWidth="3" /></> : <><Path d="M-79 0q44 25 69 0m20 0q25 25 69 0" /><Path d={starPath(0,0,11)} /><Circle cx="-91" r="3" /><Circle cx="91" r="3" /></>}</G>
    <G transform="translate(250 656)"><Path d="M-88 0c29-29 48 19 69-6m107 6c-29-29-48 19-69-6" /><Path d={starPath(0,-2,10)} /></G>
    <G opacity=".05"><Circle cx="250" cy="355" r="102" /><Circle cx="250" cy="355" r="115" /><Path d={starPath(250,355,73)} /></G>
  </G></Svg>;
}
