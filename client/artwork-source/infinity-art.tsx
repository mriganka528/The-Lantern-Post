import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from './svg-elements';
// Night colours are baked into a second bundled image; no runtime filters or extra scene loops.
const nightColours: Record<string, string> = {
  '#FFF8E8': '#414666',
  '#D0C2AE': '#8C8DAC',
  '#ADADC0': '#4B526F',
  '#8E91A9': '#7784A6',
  '#CAC3C5': '#7182A3',
  '#EAD6CA': '#9E8AA4',
  '#E7DCC0': '#A49AAC',
  '#B39D78': '#BEA177',
  '#B69FAB': '#655576',
  '#9BAFAD': '#455774',
  '#91A8AE': '#F1CD87',
  '#8D91B3': '#0C122C',
  '#C7C3D1': '#252947',
  '#F2E6CF': '#3E3958',
  '#FFF4CF': '#A5AADF',
  '#FFF2DA': '#6B709F',
  '#AA9268': '#917849',
  '#EFE0B9': '#E5CD91',
  '#B49C72': '#B49769',
  '#CDDCD2': '#8CB8C7',
  '#C0CBB5': '#546471',
  '#A5AF9A': '#809194',
  '#B8B6BF': '#565571',
  '#D6D0CC': '#85819E',
  '#EADFC5': '#B7BADD',
  '#ECDCC0': '#A199B4',
  '#B2BFAB': '#567B79',
  '#92A58E': '#85A39A',
  '#D5ABB1': '#C58BA4',
  '#B9959C': '#865D83',
  '#E4D9C0': '#9B97B2',
  '#F2E5CB': '#CAC4D4',
  '#DDCAA0': '#B4AACD',
};
const shade = (colour: string, night: boolean) => night ? nightColours[colour] ?? colour : colour;
function Cloud({ x, y, scale = 1, night = false }: { x: number; y: number; scale?: number; night?: boolean }) { return <G transform={`translate(${x} ${y}) scale(${scale})`} fill={shade('#FFF8E8', night)} stroke={shade('#D0C2AE', night)} strokeWidth=".6"><Path d="M-120 12c-17-23 4-39 32-33-1-30 40-47 60-22 10-37 61-32 73-5 30-18 73 0 65 28 42-2 46 36 9 38-75 13-158 10-239-6z" /></G>; }
function Island({ x, y, scale = 1, rose = false, night = false }: { x: number; y: number; scale?: number; rose?: boolean; night?: boolean }) { return <G transform={`translate(${x} ${y}) scale(${scale})`}>
  <Path d="M-117 87h234l-31 25-44 16-39 57-36-55-49-12z" fill={shade('#ADADC0', night)} stroke={shade('#8E91A9', night)} /><Path d="M-72 112 1 168 66 112" fill="none" stroke={shade('#CAC3C5', night)} />
  <G fill={shade(rose ? '#EAD6CA' : '#E7DCC0', night)} stroke={shade('#B39D78', night)} strokeWidth="1.4"><Path d="M-84 83V-51q84-87 168 0V83z" /><Path d="M-97-49 0-115 97-49z" fill={shade(rose ? '#B69FAB' : '#9BAFAD', night)} /><Path d="M-101 86h202v12h-202zM-95 99h190v9H-95z" /><Path d="M-15-95v-36m-5 6h10" fill="none" /><Circle cy="-136" r="4" fill={shade('#E9CC91', night)} />
    {[-63, -21, 21, 63].map(cx => <G key={cx}><Path d={`M${cx - 11} 72V-8q11-24 22 0v80z`} fill={shade('#91A8AE', night)} /><Path d={`M${cx - 16} 76V-18m32 94V-18`} fill="none" stroke={shade('#FFF0CB', night)} strokeWidth="5" /></G>)}
    <Path d="M-91-38H91M-105 82h210M-74 72H74" fill="none" stroke={shade('#EFD9AC', night)} strokeWidth="4" />
  </G><Cloud night={night} x={0} y={116} scale={1.05} />
</G>; }
export function InfinityWorldArt({ night = false }: { night?: boolean } = {}) {
  return <Svg width={1600} height={1000} viewBox="0 0 1600 1000"><Defs>
    <LinearGradient id="infinity-sky" x2="0" y2="1"><Stop stopColor={shade('#8D91B3', night)} /><Stop offset=".45" stopColor={shade('#C7C3D1', night)} /><Stop offset="1" stopColor={shade('#F2E6CF', night)} /></LinearGradient>
    <RadialGradient id="infinity-halo"><Stop stopColor={shade('#FFF4CF', night)} stopOpacity=".85" /><Stop offset=".5" stopColor={shade('#FFF2DA', night)} stopOpacity=".35" /><Stop offset="1" stopColor={shade('#FFF2DA', night)} stopOpacity="0" /></RadialGradient>
    <LinearGradient id="infinity-gold"><Stop stopColor={shade('#AA9268', night)} /><Stop offset=".5" stopColor={shade('#EFE0B9', night)} /><Stop offset="1" stopColor={shade('#B49C72', night)} /></LinearGradient>
    <RadialGradient id="night-lantern-glow"><Stop stopColor="#FFF0BA" stopOpacity=".52" /><Stop offset="1" stopColor="#F5C77A" stopOpacity="0" /></RadialGradient>
  </Defs><Rect width="1600" height="1000" fill="url(#infinity-sky)" /><Ellipse cx="800" cy="340" rx="580" ry="610" fill="url(#infinity-halo)" />
    <G stroke={shade('#E6D6B7', night)} fill="none" opacity=".4"><Ellipse cx="800" cy="430" rx="625" ry="338" /><Ellipse cx="800" cy="430" rx="655" ry="359" /><Path d="M179 560Q800 4 1421 560M191 303q609 464 1218 0" />
      {[0, 1, 2, 3, 4, 5].map(i => <Circle key={i} cx={180 + i * 246} cy={390 - i % 3 * 79} r="5" fill={shade('#EADDBD', night)} />)}
    </G><Circle cx="800" cy="156" r="91" fill={shade('#F4E7C6', night)} /><Circle cx="800" cy="156" r="106" fill="none" stroke={shade('#D5BC8D', night)} /><Circle cx="800" cy="156" r="116" fill="none" stroke={shade('#ECE1C5', night)} opacity=".65" />
    <Path d="M836 79c-64 6-96 112-15 158-102-14-105-143-21-166z" fill={shade('#FFFADE', night)} opacity=".74" />
    <G fill={shade('#FFF6D5', night)} opacity=".85">{Array.from({ length: 100 }, (_, i) => { const x = 50 + i * 137 % 1500; const y = 30 + i * 83 % 780; return i % 5 ? <Circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 2.1} /> : <Path key={i} d={`m${x} ${y - 5} 2 3 3 2-3 2-2 3-2-3-3-2 3-2z`} />; })}</G>
    <Cloud night={night} x={183} y={236} scale={1.9} /><Cloud night={night} x={1390} y={273} scale={2.1} /><Cloud night={night} x={437} y={397} scale={1.4} /><Cloud night={night} x={1150} y={402} scale={1.7} />
    <Island night={night} x={238} y={440} scale={1.2} /><Island night={night} x={1375} y={459} scale={1.12} rose /><Island night={night} x={507} y={258} scale={.49} rose /><Island night={night} x={1075} y={228} scale={.48} />
    <G fill={shade('#CDDCD2', night)} opacity=".8"><Path d="M210 548c17 44 2 75 22 132 13 45-8 65 17 102l28-5c-22-50-2-78-15-113-19-50-2-80-19-121zM1364 563c21 69 0 103 17 151 16 56-9 71 16 111l-29 4c-22-40-1-70-17-112-14-45 5-103-20-150z" /></G>
    <G stroke={shade('#FFFBE5', night)} fill="none" opacity=".65" strokeWidth="3"><Path d="M230 554c20 83-1 89 25 154m1095-135c22 79 0 109 22 156" /></G>
    <Cloud night={night} x={88} y={757} scale={2.4} /><Cloud night={night} x={1487} y={802} scale={2.3} />
    <G fill={shade('#C0CBB5', night)} stroke={shade('#A5AF9A', night)}><Path d="M451 788c89-131 94-118 161-179 88-70 268-49 354-6 91 70 145 78 198 184z" /><Path d="M493 782c119-79 452-75 626 0l-109 84-210 104-221-102z" fill={shade('#B8B6BF', night)} /><Path d="m539 804 177 49 84 98 96-100 153-41" fill="none" stroke={shade('#D6D0CC', night)} strokeWidth="3" /></G>
    <G fill="url(#infinity-gold)" stroke={shade('#B19970', night)} strokeWidth="2"><Path d="M665 659V406a135 135 0 0 1 270 0v253h-30V408a105 105 0 0 0-210 0v251z" /><Path d="M649 650h302v22H649zM627 672h346v20H627zM607 692h386v20H607zM587 712h426v22H587z" />
      <Path d="M655 416h48v15h-48zM897 416h48v15h-48zM675 443v190m250-190v190" fill="none" stroke={shade('#F7E9C9', night)} strokeWidth="4" />
      <Path d="m778 283-9-23 20 9 11-23 11 23 20-9-9 23z" fill={shade('#DDC18A', night)} /><Circle cx="800" cy="237" r="4" />
    </G><Path d="M698 650V409a102 102 0 0 1 204 0v241z" fill={shade('#EADFC5', night)} /><Path d="M706 647V410a94 94 0 0 1 188 0v237z" fill="url(#infinity-halo)" />
    <G fill="none" stroke={shade('#BCA36F', night)} opacity=".65"><Path d="M715 623V407a85 85 0 0 1 170 0v216M726 637h148" /><Path d="m800 391 9 22 22 9-22 9-9 22-9-22-22-9 22-9z" /></G>
    <Path d="M586 915 715 735h170l129 180z" fill={shade('#ECDCC0', night)} stroke={shade('#C3AE84', night)} /><Path d="M627 902 735 739m238 163L865 739" stroke={shade('#F9ECCB', night)} fill="none" strokeWidth="3" />
    <G fill={shade('#B2BFAB', night)} stroke={shade('#92A58E', night)}>{[552, 1038].map(x => <G key={x}><Path d={`M${x} 746c-40-107 16-128 5-182 43 68-7 110 10 182z`} />{[0, 1, 2, 3].map(i => <Ellipse key={i} cx={x + i % 2 * 26} cy={710 - i * 31} rx="31" ry="8" transform={`rotate(${i % 2 ? -30 : 30} ${x + i % 2 * 26} ${710 - i * 31})`} />)}</G>)}</G>
    <G fill={shade('#D5ABB1', night)} stroke={shade('#B9959C', night)}>{[[548, 635], [579, 698], [1028, 620], [1057, 714]].map(([x, y]) => <G key={x} transform={`translate(${x} ${y})`}><Path d="M0-11c14-9 16 1 11 7 16 9 3 17-5 10-9 14-19-2-11-6-14-5-7-20 5-11z" /><Circle r="3" fill={shade('#EDDBB4', night)} /></G>)}</G>
    <Cloud night={night} x={277} y={910} scale={2.8} /><Cloud night={night} x={1320} y={939} scale={2.8} /><Cloud night={night} x={792} y={1031} scale={4.3} />
    {/* Gilded architecture and engraved celestial details are baked into one
        image, keeping the richer world inexpensive to pan on a phone. */}
    <G fill="none" stroke={shade('#C9B17A', night)} strokeWidth="1.5" opacity=".8">
      <Path d="M639 645V403a161 161 0 0 1 322 0v242M629 643V403a171 171 0 0 1 342 0v240" />
      {Array.from({ length: 23 }, (_, i) => { const a = Math.PI + i * Math.PI / 22; return <Circle key={i} cx={800 + Math.cos(a) * 156} cy={405 + Math.sin(a) * 168} r="4" fill={shade('#F5E7BB', night)} />; })}
      {[651, 670, 930, 949].map(x => <Path key={x} d={`M${x} 438v187m-5-180h10m-10 28h10m-10 122h10`} stroke={shade('#F8E9C5', night)} strokeWidth="2" />)}
      <Path d="M489 654q311 112 622 0M474 667q326 120 652 0" />
      <Path d="M355 519q183 99 281 10m328 0q98 89 281-10M347 528q191 115 284 12m338 0q93 103 284-12" />
      {[409,457,506,1094,1143,1191].map(x => <Path key={x} d={`M${x} ${x<800?551+(x-409)*.3:580-(x-1094)*.3}v28`} />)}
      <Ellipse cx="800" cy="790" rx="87" ry="19" /><Ellipse cx="800" cy="790" rx="109" ry="25" /><Path d="m800 769 12 15 40 6-40 6-12 15-12-15-40-6 40-6z" />
    </G>
    {night && <G>{[584, 1016].map(x => <Ellipse key={x} cx={x} cy="349" rx="72" ry="95" fill="url(#night-lantern-glow)" />)}<Ellipse cx="800" cy="156" rx="160" ry="160" fill="url(#night-lantern-glow)" /></G>}
    <G fill={shade('#F2E5C2', night)} stroke={shade('#B9A06D', night)} strokeWidth="1.2">{[584,1016].map(x => <G key={x}><Path d={`M${x} 228v92`} fill="none" /><Path d={`m${x-14} 331 14-12 14 12-5 39h-18z`} /><Path d={`M${x-11} 337h22m-16 0v26m10-26v26`} fill="none" /><Circle cx={x} cy="349" r="4" fill={shade('#FFF6C8', night)} /></G>)}</G>
    <G transform="translate(800 156)" stroke={shade('#C6AC75', night)} fill="none" opacity=".7"><Circle r="126" />{Array.from({length:24},(_,i)=><Path key={i} d="M0-128v10m-2-5h4" transform={`rotate(${i*15})`} />)}<Path d="M-145 0h-33m323 0h33M0-145v-18" /></G>
    <G fill={shade('#E4D9C0', night)} stroke={shade('#B8A47F', night)} strokeWidth="1.1">{[430,1170].map((x,i)=><G key={x} transform={`translate(${x} ${i?662:618})`}><Path d="M-28 74h56l-9-11h-38z" /><Path d="M-18 58c-4-24 6-38 8-49h20c2 11 12 25 8 49z" /><Circle cy="0" r="11" fill={shade('#F2E5CB', night)} /><Path d="m-11-10-4-10 10 5 5-13 5 13 10-5-4 10z" fill={shade('#D3B978', night)} /><Path d="M-10 17q-35-15-29-35 27 0 30 29m19 6q35-15 29-35-27 0-30 29" fill={shade('#F3E8D1', night)} /><Path d="M-19 28q-14 6-17 22m55-22q14 6 17 22M-9 15v40m18-40v40" fill="none" /></G>)}</G>
    <G fill="none" stroke={shade('#DDCAA0', night)} opacity=".7"><Rect x="14" y="14" width="1572" height="972" rx="20" /><Rect x="21" y="21" width="1558" height="958" rx="17" />{[false,true].map(right=><G key={String(right)} transform={right?'translate(1600 0) scale(-1 1)':undefined}>{[false,true].map(bottom=><G key={String(bottom)} transform={bottom?'translate(0 1000) scale(1 -1)':undefined}><Path d="M33 113V54q0-21 21-21h91M41 98V58q0-17 17-17h42M52 51c42-5 13 31 31 38s30-16 12-18c9-19 28-7 21 10" /><Circle cx="49" cy="120" r="3" /><Circle cx="146" cy="49" r="3" /></G>)}</G>)}</G>
  </Svg>;
}
