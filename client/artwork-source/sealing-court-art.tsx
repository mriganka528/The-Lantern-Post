import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from './svg-elements';

export function SealingCourtArt() {
  return <Svg width={1400} height={740} viewBox="0 0 1400 740">
    <Defs><LinearGradient id="seal-sky" x2="0" y2="1"><Stop stopColor="#C8CCD9" /><Stop offset=".52" stopColor="#EADDCF" /><Stop offset="1" stopColor="#F5EBD4" /></LinearGradient><RadialGradient id="seal-light"><Stop stopColor="#FFFBE9" /><Stop offset="1" stopColor="#FFFBE9" stopOpacity="0" /></RadialGradient><LinearGradient id="seal-stone"><Stop stopColor="#B29B73" /><Stop offset=".45" stopColor="#EFE1BD" /><Stop offset="1" stopColor="#C7AF82" /></LinearGradient></Defs>
    <Rect width="1400" height="740" fill="url(#seal-sky)" /><Ellipse cx="700" cy="335" rx="410" ry="400" fill="url(#seal-light)" />
    <G fill="#FFFAE6" opacity=".7"><Path d="M0 199c105-46 182-35 257 12 80-61 174-39 224-15 78-47 109-9 146 0 54-48 159-35 204 1 106-45 177-16 220 11 121-74 236-21 349-15v41H0z" /><Path d="M0 567c115-83 179-28 231-8 86-61 169-34 231 7 57-54 140-68 238-3 92-64 176-52 238 3 62-41 145-68 231-7 67-33 123-75 231 8v173H0z" /></G>
    <G fill="none" stroke="#B9A06F"><Path d="M310 630V269a390 390 0 0 1 780 0v361M333 626V271a367 367 0 0 1 734 0v355" strokeWidth="2" /><Path d="M355 630V274a345 345 0 0 1 690 0v356" opacity=".55" />
      <Circle cx="700" cy="329" r="188" opacity=".55" /><Circle cx="700" cy="329" r="202" opacity=".3" /><Path d="M492 329h-42m458 0h42M700 115V87m0 485v-34" opacity=".6" />
    </G>
    {[false, true].map(mirror => <G key={String(mirror)} transform={mirror ? 'translate(1400 0) scale(-1 1)' : undefined}>
      <G stroke="#AA9166" fill="url(#seal-stone)" strokeWidth="1.5"><Rect x="137" y="155" width="60" height="462" rx="5" /><Rect x="126" y="135" width="82" height="23" rx="5" /><Path d="m118 115 98 0-16 23h-65zM129 617h75v21h-75zM114 638h105v17H114z" /><Path d="M150 168v432m13-432v432m13-432v432m13-432v432" stroke="#F8ECCF" opacity=".7" /><Path d="M116 109V20h39v76h244v16z" /><Path d="M130 30h111v23H153" fill="#E5D6B3" /></G>
      <G fill="#DDD0BC" stroke="#AF996F" opacity=".8"><Path d="M260 484V327l42-32 42 32v157zM252 327l50-73 50 73z" /><Path d="M278 482v-69q24-33 48 0v69M287 349v25h30v-25z" fill="#A3B8B3" /><Path d="M245 485h113l-23 19h-67z" /></G>
      <G fill="#F9F3DF" stroke="#B9A06F"><Path d="M260 52v86" fill="none" /><Path d="m238 151 22-15 22 15-6 42h-32z" fill="#EFDEA7" /><Path d="M242 151h36m-27 1v32m18-32v32M252 204h16" fill="none" /><Circle cx="260" cy="167" r="6" fill="#FFF7C2" /></G>
      <G fill="#BAC7AF" stroke="#95A18A"><Path d="M82 651c44-108 45-107 77-173-16 81-21 135-13 173z" /><Path d="M154 631c78-36 53-92 93-139-17 50-5 89-24 139z" />{Array.from({ length: 9 }, (_, i) => <Ellipse key={i} cx={98 + (i % 3) * 20} cy={625 - i * 13} rx="22" ry="6" transform={`rotate(${i % 2 ? -38 : 28} ${98 + (i % 3) * 20} ${625 - i * 13})`} />)}</G>
      <G fill="#D3ADAA" stroke="#B98E86">{[[115, 579], [161, 618], [229, 546], [145, 520]].map(([x, y]) => <G key={x} transform={`translate(${x} ${y})`}><Path d="M0-11c9-8 17 0 12 7 12 5 5 17-4 14-3 11-16 4-12-3-13 1-16-12-6-15-5-8 6-14 10-3z" /><Circle r="4" fill="#EDDBA5" /></G>)}</G>
    </G>)}
    <G fill="#FDF8E7" stroke="#C2AB7D" strokeWidth="1.4"><Path d="M283 664h834l-55 22H338z" /><Path d="M337 686h726l-35 21H372z" /><Path d="M372 707h656l33 25H339z" /></G>
    <G fill="#FFF8DC" stroke="#BDA370" strokeWidth=".7">{Array.from({ length: 35 }, (_, i) => { const x = 350 + (i * 137) % 700; const y = 29 + (i * 83) % 515; return <Path key={i} d={`m${x} ${y - 5} 1.6 3.4 3.4 1.6-3.4 1.6-1.6 3.4-1.6-3.4-3.4-1.6 3.4-1.6z`} opacity={.25 + i % 4 * .16} />; })}</G>
    <G fill="#D5B877" stroke="#AE925C"><Path d="m670 89-6-22 22 11 14-23 14 23 22-11-6 22z" /><Path d="M669 94h62" strokeWidth="3" /><Circle cx="700" cy="47" r="3" /></G>
    <Rect x="12" y="12" width="1376" height="716" rx="8" fill="none" stroke="#CFBA91" /><Rect x="18" y="18" width="1364" height="704" rx="6" fill="none" stroke="#F4E8CB" />
  </Svg>;
}
