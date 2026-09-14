import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from './svg-elements';
function Emblem({ monochrome = false }: { monochrome?: boolean }) {
  const gold = monochrome ? '#FFFFFF' : '#B08D4E'; const light = monochrome ? '#FFFFFF' : '#F8E7B4';
  return <G stroke={gold} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round">
    <Path d="M245 787V376a267 267 0 0 1 534 0v411" fill="none" /><Path d="M270 784V378a242 242 0 0 1 484 0v406" fill="none" strokeWidth="3" />
    <Path d="M361 422 512 306l151 116-33 322H394z" fill={monochrome ? 'none' : '#E7C986'} /><Path d="M346 418h332M385 746h254M407 779h210M452 306q-7-93 60-93t60 93" fill="none" />
    <Path d="M411 449v251m64-252v251m75-251v251m64-251v251" fill="none" stroke={light} strokeWidth="8" />
    <Path d="M512 504c-27 54-57 74-43 116 13 45 84 43 90-6 5-35-21-49-17-79-17 16-17 30-21 37-15-22-5-41-9-68z" fill={light} stroke="none" />
    <Path d="M191 747c-31-79-19-139 25-179m-11 28q-75-6-53 41 37 20 55-11m-6 40q-67 3-35 39 34 14 38-10m-10 50q-66-8-41 30 27 24 49 6M833 747c31-79 19-139-25-179m11 28q75-6 53 41-37 20-55-11m6 40q67 3 35 39-34 14-38-10m10 50q66-8 41 30-27 24-49 6" fill="none" strokeWidth="7" />
    <Path d="m512 88 12 34 34 12-34 12-12 34-12-34-34-12 34-12zM303 230l7 21 21 7-21 7-7 21-7-21-21-7 21-7zM722 225l7 21 21 7-21 7-7 21-7-21-21-7 21-7z" fill={light} strokeWidth="3" />
    <Path d="M344 832q102 36 168-1 66 37 168 1M424 866h176" fill="none" strokeWidth="5" /><Circle cx="512" cy="870" r="10" fill={light} strokeWidth="3" />
  </G>;
}
export function BrandIcon({ foreground = false, monochrome = false }: { foreground?: boolean; monochrome?: boolean }) {
  return <Svg width={1024} height={1024} viewBox="0 0 1024 1024"><Defs><LinearGradient id="brand-paper" x2="1" y2="1"><Stop stopColor="#FFF8E7" /><Stop offset="1" stopColor="#E8DAB9" /></LinearGradient></Defs>{!foreground && <Rect width="1024" height="1024" fill="url(#brand-paper)" />}<G transform={foreground ? 'translate(102 102) scale(.8)' : undefined}>{!monochrome && <><Circle cx="512" cy="492" r="390" fill="none" stroke="#C5AC7B" strokeWidth="2" /><Circle cx="512" cy="492" r="375" fill="none" stroke="#C5AC7B" opacity=".3" /></>}<Emblem monochrome={monochrome} /></G></Svg>;
}
export function StoreFeatureArt() {
  return <Svg width={1024} height={500} viewBox="0 0 1024 500"><Defs><LinearGradient id="feature-sky" x2="1" y2="1"><Stop stopColor="#E5DBCD" /><Stop offset=".5" stopColor="#F8EFD9" /><Stop offset="1" stopColor="#D9DCD7" /></LinearGradient></Defs><Rect width="1024" height="500" fill="url(#feature-sky)" /><Rect x="14" y="14" width="996" height="472" rx="16" fill="none" stroke="#B9A071" /><Rect x="22" y="22" width="980" height="456" rx="12" fill="none" stroke="#DED0AF" /><G transform="translate(22 10) scale(.46)"><Emblem /></G><G fill="#FDF7E8" opacity=".65"><Ellipse cx="865" cy="386" rx="185" ry="63" /><Ellipse cx="980" cy="448" rx="190" ry="82" /><Ellipse cx="728" cy="470" rx="180" ry="65" /></G><text x="507" y="193" fontFamily="Georgia,serif" fontSize="52" fill="#66543A">Lantern Post</text><text x="510" y="241" fontFamily="Georgia,serif" fontSize="21" fill="#887252">Write it. Seal it. Let it go.</text><Path d="M508 273h330" stroke="#BEA371" /><text x="510" y="321" fontFamily="Georgia,serif" fontSize="17" fill="#827054">A little world for your words.</text><G fill="#D1B87D">{[[511,95],[886,133],[946,296],[737,82],[487,382]].map(([x,y])=><Path key={x} d={`m${x} ${y!-9} 3 6 6 3-6 3-3 6-3-6-6-3 6-3z`} />)}</G></Svg>;
}
