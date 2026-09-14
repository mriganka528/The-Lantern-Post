import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from './svg-elements';

export function RoyalNavigationArt() {
  return <Svg width={1400} height={196} viewBox="0 0 1400 196">
    <Defs><LinearGradient id="court-wood" x2="0" y2="1"><Stop stopColor="#45554A" /><Stop offset=".45" stopColor="#33483D" /><Stop offset="1" stopColor="#263B32" /></LinearGradient><LinearGradient id="court-gold"><Stop stopColor="#8D7241" /><Stop offset=".3" stopColor="#E8D4A0" /><Stop offset=".7" stopColor="#BE9D5C" /><Stop offset="1" stopColor="#806037" /></LinearGradient></Defs>
    <Rect width="1400" height="196" fill="url(#court-wood)" />
    <G stroke="#B7A373" fill="none" opacity=".08"><Path d="M0 49c190-65 219 33 370 0s299-58 453 0 409-81 577 0M0 126c210-65 253 34 414 0s289-55 491 0 382-72 495 0M0 160c127-67 335 27 439 0s219-55 420 0 368-79 541 0" /></G>
    <G fill="none" stroke="url(#court-gold)"><Path d="M0 6h1400M0 12h1400M0 184h1400M0 190h1400" strokeWidth="1.5" /><Path d="M0 19h1400M0 177h1400" opacity=".3" /></G>
    {[false, true].map(right => <G key={String(right)} transform={right ? 'translate(1400 0) scale(-1 1)' : undefined} fill="none" stroke="#C9AE72">
      <Path d="M20 26v144m8-144v144M39 24c71 0 52 38 14 35-23-2-29-16-13-21 21-5 23 14 13 15M39 172c71 0 52-38 14-35-23 2-29 16-13 21 21 5 23-14 13-15" opacity=".6" />
      <Path d="M37 96c40-54 60 45 91 0-31 21-14-33-57-22m-34 22c40 54 60-45 91 0-31-21-14 33-57 22" opacity=".2" />
      <Path d="m22 87 7 10-7 10-7-10z" fill="#BDA063" strokeWidth=".7" />
      <Circle cx="28" cy="26" r="3" fill="#D4BB80" /><Circle cx="28" cy="170" r="3" fill="#D4BB80" />
    </G>)}
    <G stroke="#DDC797" fill="none" opacity=".26"><Path d="M483 16c91 0 78 35 177 15m-177 150c91 0 78-35 177-15M917 16c-91 0-78 35-177 15m177 150c-91 0-78-35-177-15" /><Path d="m682 17-4 13 10-3 12 9 12-9 10 3-4-13m-36 155-4-13 10 3 12-9 12 9 10-3-4 13" /></G>
    <G fill="#E8D7AF" opacity=".18">{Array.from({ length: 16 }, (_, i) => { const x = 130 + i * 77; const y = 29 + (i * 23) % 137; return <Path key={i} d={`M${x} ${y - 3}l1 2 2 1-2 1-1 2-1-2-2-1 2-1z`} />; })}</G>
  </Svg>;
}
