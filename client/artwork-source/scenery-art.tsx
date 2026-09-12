import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Stop } from './svg-elements';

const riverPath = 'M140 577C320 529 374 617 567 589s267 39 654-4v80c-337 34-392-44-579-14S345 615 142 629z';

export function SceneryBackdrop() {
  return <G stroke="#9CAD9B" strokeWidth="1">
    <Path d="M115 394c39-79 100-113 183-41l-7 145-41 22-45-36-44-5zM895 353c83-72 144-38 183 41l-46 85-44 5-45 36-41-22z" fill="#BBC5AA" />
    <Path d="M127 395c47-54 101-43 169-41l-8 23c-64-19-104-7-153 33M899 355c64-21 132-5 170 40l-10 15c-48-43-101-52-155-33" fill="#D7DDC0" />
    <Path d="M206 368c6 69-3 113-8 155h59c-15-48-17-104-11-154zM955 369c6 50 4 106-11 154h59c-5-42-14-86-8-155z" fill="#B4D9D6" stroke="#91BAB5" />
    <G fill="none" stroke="#EEF8E9" strokeWidth="4" opacity=".8"><Path d="M219 378c-3 41 1 91-9 135m23-139c-3 59 0 97 7 143M968 378c-2 59-2 97-7 137m22-140c3 61 0 94 8 137" /></G>
    <Ellipse cx="227" cy="528" rx="55" ry="13" fill="#BDD9CE" /><Ellipse cx="974" cy="528" rx="55" ry="13" fill="#BDD9CE" />
    <G fill="#F8F9E9" stroke="none" opacity=".9"><Ellipse cx="226" cy="521" rx="36" ry="8" /><Ellipse cx="974" cy="521" rx="36" ry="8" /></G>
    <G fill="#9CAF8C" stroke="#839771">{[168, 215, 968, 1020].map(x => <G key={x}><Path d={`M${x} 354v-46`} /><Path d={`m${x - 20} 337 20-69 20 69z`} /></G>)}</G>
  </G>;
}

export function SceneryForeground() {
  return <G>
    <Path d={riverPath} fill="#BEDAD0" stroke="#91B8A9" strokeWidth="1" />
    <Path d="M189 597c174-20 226 61 408 14s282 38 551 2M737 638c143-5 176 28 322 11" fill="none" stroke="#F5FAE8" strokeWidth="2" opacity=".8" />
    <G stroke="#A28B60" fill="#EADCC0" strokeWidth="1.5">
      <Path d="M496 656v-18q104-92 208 0v18h-26v-14q-78-66-156 0v14z" />
      <Path d="M491 637q109-91 218 0v-13q-109-89-218 0z" fill="#F5EACE" />
      <Path d="M498 621v-23m28 4v-25m33 11v-28m41 22v-28m41 34v-28m33 42v-25m28 44v-23" fill="none" strokeWidth="4" />
      <Path d="M491 602q109-92 218 0" fill="none" strokeWidth="4" /><Path d="M497 652q103-94 206 0" fill="none" opacity=".5" />
    </G>
    <G fill="#A6B48C" stroke="#899C79" strokeWidth="1">
      {[335, 382, 835, 873].map((x, i) => <G key={x}><Path d={`M${x} 581v-27m0 13-8-8m8 1 8-6`} /><Circle cx={x} cy={549 - i % 2 * 3} r="6" fill="#E4BABC" /><Circle cx={x} cy={549 - i % 2 * 3} r="2" fill="#F8E7B8" /></G>)}
    </G>
  </G>;
}

export function RiverLightArt() {
  return <Svg width={1200} height={660} viewBox="0 0 1200 660">
    <Defs><ClipPath id="river-shape"><Path d={riverPath} /></ClipPath></Defs>
    <G clipPath="url(#river-shape)" stroke="#FBFFF0" fill="none" strokeWidth="1.5" opacity=".8">
      {Array.from({ length: 32 }, (_, i) => {
        const x = 150 + (i * 71) % 1040; const y = 576 + (i * 13) % 89;
        if (x > 470 && x < 730) return null; // Keep the stone bridge above the water highlights.
        return <Path key={i} d={`M${x} ${y}q12-4 28 0m8 0h9`} />;
      })}
    </G>
  </Svg>;
}

export function WaterfallLightArt() {
  return <Svg width={54} height={170} viewBox="0 0 54 170">
    <G stroke="#F8FFF2" fill="none" strokeLinecap="round" opacity=".85">
      {[9, 17, 29, 36, 44].map((x, i) => <G key={x}><Path d={`M${x} ${i * 11 - 36}q-3 15 0 32m0 19q3 21 0 40m0 17v36`} strokeWidth={i % 2 ? 2 : 3} /></G>)}
    </G>
  </Svg>;
}

export function RoyalFigureArt({ kind }: { kind: 'queen' | 'angel' }) {
  const angel = kind === 'angel';
  return <Svg width={140} height={190} viewBox="0 0 140 190">
    <Defs><LinearGradient id={`gown-${kind}`} x2="1" y2="1"><Stop stopColor={angel ? '#FFFBE7' : '#E9D8C6'} /><Stop offset="1" stopColor={angel ? '#DBE7DF' : '#B996A8'} /></LinearGradient></Defs>
    <G stroke="#A58D64" strokeWidth="1.1" strokeLinejoin="round">
      {angel && <>
        <Path d="M57 91C21 96 7 72 5 34c18 20 26 14 37 26 6 7 7 16 15 19M83 91c36 5 50-19 52-57-18 20-26 14-37 26-6 7-7 16-15 19" fill="#FFFCEE" />
        <Path d="M15 57c4 13 16 24 29 25M26 59c4 12 8 16 18 20m81-22c-4 13-16 24-29 25m18-23c-4 12-8 16-18 20" fill="none" stroke="#C6CDB6" />
        <Ellipse cx="70" cy="26" rx="20" ry="5" fill="none" stroke="#D3BA74" strokeWidth="2" />
      </>}
      {!angel && <Path d="M49 53c-3 14-9 26-10 44h62c-2-19-7-30-10-44" fill="#A68764" />}
      <Path d="M58 77c-16 19-5 34-25 72-9 17-10 26-4 27 28 5 55 12 84-1-3-20-24-50-26-76l-6-22z" fill={`url(#gown-${kind})`} />
      <Path d="M59 99c5 39-8 62-8 74m28-74c-3 36 9 67 9 75M39 169c22 4 42 7 64 0" fill="none" opacity=".55" />
      <Path d="M58 83c-12 4-13 21-26 22-5 0-3-5-1-7l18-24m33 9c13 4 12 19 26 16 5-1 3-6-1-7L91 75" fill="#F0D8C0" />
      <Path d="m54 93 16 8 18-8m-21-5v16" fill="none" stroke="#D0B36C" strokeWidth="3" />
      <Path d="M62 63h16v17c-5 8-11 8-16 0z" fill="#EED5BB" />
      <Ellipse cx="70" cy="51" rx="18" ry="23" fill="#F3DBC1" />
      <Path d="M51 52c-6-30 41-37 39-7-13-3-23-14-25-10-2 9-7 14-14 17" fill={angel ? '#DAC08D' : '#A38769'} />
      <Path d="M61 52h3m12 0h3m-14 12q5 3 10 0" fill="none" stroke="#8B7155" />
      {!angel && <><Path d="m51 33-2-17 13 8 8-19 8 19 13-8-2 17z" fill="#D1B779" /><Circle cx="70" cy="23" r="3" fill="#B8888D" /><Path d="M107 96V54m-6 6 6-8 6 8-6 8z" fill="#E2CB86" /></>}
      <Path d="M53 175c3 10 10 10 12 0m11 0c2 10 9 10 12 0" fill="#E7D4AC" />
    </G>
  </Svg>;
}
