import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from './svg-elements';

function Temple({ x, y, scale = 1, mirror = false }: { x: number; y: number; scale?: number; mirror?: boolean }) {
  return <G transform={`translate(${x} ${y}) scale(${mirror ? -scale : scale} ${scale})`} stroke="#A28A75" strokeWidth="1.5" strokeLinejoin="round">
    <Path d="M-184 15c59-62 112-35 179-37 76-33 132-9 182 27l-39 58-64 22-76 95-62-103-63-12z" fill="#51434C" />
    <Path d="m-123 38 31 65 28-25M112 33 81 84 31 153m-139-116 30 11m134-9 56 13" fill="none" opacity=".5" />
    <Path d="M-155 11h310v17h-310zM-131-14h262v25h-262z" fill="#92735F" />
    <Path d="M-111-16v-155h222v155z" fill="#76616A" />
    <Path d="m-132-173 132-79 132 79z" fill="#634B58" /><Path d="m-106-180 106-60 106 60M-125-166h250" fill="none" stroke="#C0A278" />
    <Path d="M-44-15v-116a44 44 0 0 1 88 0v116" fill="#3B303A" /><Path d="M-32-18v-109a32 32 0 0 1 64 0v109" fill="#C59B68" opacity=".55" /><Path d="M0-157v136M-37-101h74" fill="none" />
    {[-96, -65, 65, 96].map(cx => <G key={cx}><Rect x={cx - 7} y="-151" width="14" height="130" fill="#AE907A" /><Path d={`M${cx - 11}-155h22v8h-22zM${cx - 12}-23h24v9h-24z`} fill="#CEAF85" /></G>)}
    {[-132, 132].map(cx => <G key={cx}><Path d={`M${cx - 19}-25v-222h38v222z`} fill="#8B7480" /><Path d={`m${cx - 28}-250 28-67 28 67z`} fill="#A98861" /><Path d={`M${cx}-315v-26m-5 8h10M${cx - 7}-217v32h14v-32z`} fill="none" stroke="#DCC295" /></G>)}
    <Path d="M-61-255c0-48 122-48 122 0l-5 13H-56z" fill="#A67A5B" /><Path d="M0-291v-30m-7 8h14" fill="none" stroke="#DFBE82" />
  </G>;
}

export function EmberRealmArt() {
  return <Svg width={1600} height={1000} viewBox="0 0 1600 1000">
    <Defs>
      <LinearGradient id="ember-sky" x2="0" y2="1"><Stop stopColor="#181728" /><Stop offset=".5" stopColor="#3A293C" /><Stop offset="1" stopColor="#85604B" /></LinearGradient>
      <RadialGradient id="divine-dawn"><Stop stopColor="#E4B679" stopOpacity=".47" /><Stop offset=".5" stopColor="#B77E68" stopOpacity=".13" /><Stop offset="1" stopColor="#B77E68" stopOpacity="0" /></RadialGradient>
      <LinearGradient id="river-of-light" x2="0" y2="1"><Stop stopColor="#F6DBA3" /><Stop offset=".5" stopColor="#C7874F" /><Stop offset="1" stopColor="#684D51" stopOpacity=".2" /></LinearGradient>
    </Defs>
    <Rect width="1600" height="1000" fill="url(#ember-sky)" /><Ellipse cx="800" cy="423" rx="760" ry="630" fill="url(#divine-dawn)" />
    <G stroke="#D5B078" fill="none" opacity=".27"><Circle cx="800" cy="346" r="299" /><Circle cx="800" cy="346" r="289" /><Circle cx="800" cy="346" r="251" strokeDasharray="2 14" /><Ellipse cx="800" cy="346" rx="478" ry="165" transform="rotate(-19 800 346)" strokeWidth=".8" />
      {Array.from({ length: 36 }, (_, i) => <Path key={i} d="M800 42v13m-4 0h8" transform={`rotate(${i * 10} 800 346)`} />)}
    </G>
    <G fill="#F2D9A1">{Array.from({ length: 130 }, (_, i) => <Circle key={i} cx={(i * 157 + 61) % 1600} cy={(i * 97 + 47) % 675} r={i % 11 === 0 ? 2.2 : .8} opacity={.2 + i % 4 * .14} />)}</G>
    <G stroke="#E2C086" fill="none" opacity=".66">{[[145, 186], [443, 119], [1190, 137], [1450, 301], [1106, 463], [508, 335]].map(([x, y], i) => <Path key={i} d={`M${x} ${Number(y) - 9}v18m-9-9h18`} />)}
      <Path d="M232 112 290 79 337 133 373 91M1232 275l67-64 61 31 44-81" strokeWidth=".8" opacity=".4" />
    </G>
    <Path d="M1388 128a50 50 0 1 1-50-55 44 44 0 0 0 50 55" fill="#E4C893" opacity=".75" />
    <G fill="#8F7582" opacity=".16"><Path d="M0 414c145-59 238-79 372-15 115-58 184-21 228 22-180 20-371 16-600 35zM1062 421c115-69 205-56 269-18 101-57 195-43 269 9v45z" /><Path d="M0 579c205-90 292-44 425-28 222-58 443-19 595 20 181-75 352-16 580-47v125H0z" /></G>
    <G opacity=".25"><Temple x={107} y={474} scale={.48} /><Temple x={1490} y={463} scale={.52} mirror /></G>
    <Temple x={270} y={584} scale={.95} /><Temple x={1330} y={584} scale={.95} mirror />
    <G fill="url(#river-of-light)" opacity=".75"><Path d="M136 611c31 90 9 158 61 262l62 23c-52-108-57-193-53-279zM1394 617c4 86-1 171-53 279l62-23c52-104 30-172 61-262z" /></G>
    <G stroke="#F7D9A0" fill="none" opacity=".43"><Path d="M153 625c17 97 19 146 54 232m-27-222c4 73 21 161 54 235M1422 625c-1 87-25 168-53 243m64-232c-14 105-22 152-44 210" strokeWidth="2" /></G>
    <G fill="#56424E" stroke="#9F7F68" strokeWidth="1.4"><Path d="M0 856c146-35 242-70 378-4l130 148H0zM1600 856c-146-35-242-70-378-4l-130 148h508z" /><Path d="M53 887c110-32 224-27 315 31m863 0c91-58 205-63 315-31" fill="none" /></G>
    <G fill="none" stroke="#B59973"><Path d="M-35 923Q231 780 580 891M1020 891q349-111 615 32" strokeWidth="14" /><Path d="M-35 901Q231 758 580 869M1020 869q349-111 615 32" strokeWidth="4" />
      {Array.from({ length: 9 }, (_, i) => <G key={i}><Path d={`M${i * 59} ${892 - Math.sin(i / 8 * Math.PI) * 48}v30M${1600 - i * 59} ${892 - Math.sin(i / 8 * Math.PI) * 48}v30`} strokeWidth="4" /></G>)}
    </G>
    <G fill="#D7B885" stroke="#A68960" strokeWidth="2">{[108, 397, 1203, 1492].map((x, i) => <G key={x}><Path d={`M${x - 9} ${793 + i % 2 * 5}v83h18v-83zM${x - 20} 878h40v10h-40zM${x - 26} ${770 + i % 2 * 5}h52l-12 24h-28z`} fill="#8E7053" /></G>)}</G>
    <G fill="#A88770" opacity=".23"><Path d="M0 958c99-45 131-18 196-5 76-50 174-18 181 7 130-29 229-13 275 40H0zM1600 958c-99-45-131-18-196-5-76-50-174-18-181 7-130-29-229-13-275 40h652z" /></G>
    <G stroke="#D2AD71" fill="none" strokeWidth="1" opacity=".5"><Path d="M28 83V29h97m-89 0v-8h112M1475 29h97v54m-8-54v-8h-112M28 917v54h97m-89 0v8h112M1475 971h97v-54m-8 54v8h-112" /><Path d="m48 47 8 21 21 8-21 8-8 21-8-21-21-8 21-8zm1504 0 8 21 21 8-21 8-8 21-8-21-21-8 21-8z" /></G>
  </Svg>;
}

export function FireGuardianArt() {
  return <Svg width={540} height={650} viewBox="0 0 540 650">
    <Defs><LinearGradient id="guardian-robes" x2="1" y2="1"><Stop stopColor="#B48153" /><Stop offset=".4" stopColor="#6D4750" /><Stop offset="1" stopColor="#382936" /></LinearGradient><LinearGradient id="fire-hair" x2="0" y2="1"><Stop stopColor="#F5D794" /><Stop offset=".5" stopColor="#CB975C" /><Stop offset="1" stopColor="#956141" /></LinearGradient><RadialGradient id="god-halo"><Stop stopColor="#FFDCA0" stopOpacity=".28" /><Stop offset="1" stopColor="#FFDCA0" stopOpacity="0" /></RadialGradient></Defs>
    <Circle cx="270" cy="192" r="189" fill="url(#god-halo)" />
    <G stroke="#E0BB75" fill="none" opacity=".78"><Circle cx="270" cy="190" r="138" strokeWidth="2" /><Circle cx="270" cy="190" r="146" strokeWidth=".6" /><Circle cx="270" cy="190" r="157" strokeDasharray="1 9" />
      {Array.from({ length: 24 }, (_, i) => <Path key={i} d="M270 21v17" transform={`rotate(${i * 15} 270 190)`} />)}
    </G>
    <G stroke="#C8A06A" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
      <Path d="M201 245C153 269 160 335 103 412 60 467 76 545 24 603c94 58 180 23 246 36 64-12 155 23 246-36-52-58-36-136-79-191-57-77-50-143-98-167z" fill="url(#guardian-robes)" />
      <Path d="M220 273c-18 117-3 209-70 345m169-345c18 117 3 209 70 345M270 304v316M178 302c-9 117-28 209-92 290m277-290c9 117 28 209 92 290" fill="none" strokeWidth="3" opacity=".72" />
      <Path d="M174 311c-24 29-46 80-65 99-17 17-39 14-61 6l-24 36c47 32 97 22 125-6l57-66M366 311c24 29 46 80 65 99 17 17 39 14 61 6l24 36c-47 32-97 22-125-6l-57-66" fill="#98704D" />
      <Path d="M48 416c-12-8-21-26-31-19-7 4 8 12 7 20-10-5-14-20-20-16-9 8 11 26 12 31 6 16 21 21 36 15M492 416c12-8 21-26 31-19 7 4-8 12-7 20 10-5 14-20 20-16 9 8-11 26-12 31-6 16-21 21-36 15" fill="#E8CCA0" />
      <Path d="M157 318c22-51 39-65 67-71l46 59 46-59c28 6 45 20 67 71l-29 33-42-20-42 47-42-47-42 20z" fill="#B78D58" />
      <Path d="m166 316 31 16 36-23 37 44 37-44 36 23 31-16M201 270l31 28m106-28-31 28" fill="none" stroke="#E1BF7F" strokeWidth="3" />
      <Path d="M232 202h76v60c-12 28-62 29-76 0z" fill="#C99D6C" />
      <Path d="M210 123c13-65 108-59 121 0l-9 99c-8 39-38 63-53 63-22-7-45-34-50-65z" fill="#E8CB9C" />
      <Path d="M210 176c-33-50-23-91 11-105-13-20 0-48 12-57-2 31 9 43 25 49 0-27 12-44 30-60-5 39 17 58 20 73 21-13 27-26 25-42 29 37 34 56 7 81 35 36 21 66-15 83 9-38 9-74-34-91-10 20-41 43-64 46l-5 34z" fill="url(#fire-hair)" />
      <Path d="M214 186c0 49 34 49 54 42 23 9 45 0 57-42 12 64-12 63-12 86 0 27-32 36-43 64 0-30-39-38-43-63-4-25-26-48-13-87z" fill="url(#fire-hair)" />
      <Path d="M236 229c6 42 32 42 33 72m24-72c-4 34-19 43-17 64M235 95c-17 36-20 39-21 65m75-83c-13 32-28 47-55 51m75-35c26 25 30 47 18 71" fill="none" stroke="#F3D99E" strokeWidth="2" opacity=".7" />
      <Path d="M231 168q13-11 26-3m25 0q13-8 26 3m-44-1-4 30 14 3M249 213q21 10 40-2" fill="none" stroke="#936745" strokeWidth="2.4" /><Path d="M235 177h18m33 0h18" fill="none" stroke="#FFE4A1" strokeWidth="4" />
      <Path d="m215 137-9-25 37 9 26-35 27 35 37-9-9 25z" fill="#B78B4D" /><Path d="m270 101 7 15-7 12-7-12z" fill="#FFE8AB" />
      <Path d="m270 365 12 34 34 12-34 12-12 34-12-34-34-12 34-12z" fill="#ECC98B" /><Circle cx="270" cy="411" r="8" fill="#F9E6B9" />
      <G fill="none" opacity=".65">{[0, 1, 2, 3].map(i => <G key={i}><Path d={`M${113 + i * 23} ${489 + i * 16}q15-21 28 0-14 29-28 0m${188 - i * 46} 0q15-21 28 0-14 29-28 0`} /></G>)}</G>
      <Path d="M74 606c72 12 113-8 151 6m90 0c37-14 79 6 151-6" fill="none" stroke="#E0BB78" strokeWidth="3" />
    </G>
  </Svg>;
}

export function RealmAltarArt() {
  return <Svg width={1600} height={1000} viewBox="0 0 1600 1000">
    <Defs><LinearGradient id="altar-stone" x2="0" y2="1"><Stop stopColor="#BBA07C" /><Stop offset="1" stopColor="#5E4650" /></LinearGradient><LinearGradient id="altar-bronze" x2="0" y2="1"><Stop stopColor="#E0BB7A" /><Stop offset=".5" stopColor="#92704B" /><Stop offset="1" stopColor="#5C4140" /></LinearGradient></Defs>
    <G stroke="#C4A57B" strokeWidth="1.6" fill="url(#altar-stone)">
      <Path d="M484 898h632l92 102H392z" /><Path d="M445 942h710v14H445zM419 967h762v16H419z" />
      <Path d="M512 883h576v21H512zM548 862h504v22H548z" />
      <Path d="m575 887 450 0m-463 26h477m-533 21h558m-318-30v35m-99-35-13 35m215-35 14 35" fill="none" opacity=".5" />
      <Path d="M668 822c59 19 205 19 264 0l-30 61c-57 30-148 30-204 0z" fill="url(#altar-bronze)" />
      <Ellipse cx="800" cy="821" rx="134" ry="20" fill="#53403C" /><Path d="M665 819c56 31 215 31 270 0v12c-63 28-211 28-270 0z" fill="#D4B37A" />
      <Path d="M704 856c57 24 135 24 192 0M714 877c52 18 118 18 172 0m-160 13-19 21m167-21 19 21" fill="none" />
      <Path d="m800 847 9 17 17 5-17 6-9 18-9-18-17-6 17-5z" fill="#E1C187" />
      {[563, 1037].map(x => <G key={x}><Path d={`M${x - 12} 783h24v88h-24zM${x - 24} 873h48v13h-48zM${x - 28} 761h56l-12 22h-32z`} fill="url(#altar-bronze)" /></G>)}
    </G>
  </Svg>;
}

export function EmberGlowArt() {
  return <Svg width={440} height={440} viewBox="0 0 440 440"><Defs><RadialGradient id="golden-glow"><Stop stopColor="#FFE8A6" stopOpacity=".9" /><Stop offset=".24" stopColor="#E8B765" stopOpacity=".35" /><Stop offset=".65" stopColor="#C57740" stopOpacity=".1" /><Stop offset="1" stopColor="#C57740" stopOpacity="0" /></RadialGradient></Defs><Circle cx="220" cy="220" r="220" fill="url(#golden-glow)" /></Svg>;
}

export function LivingFlameArt({ alternate = false }: { alternate?: boolean }) {
  return <Svg width={300} height={390} viewBox="0 0 300 390">
    <Defs><LinearGradient id="living-fire" x2="0" y2="1"><Stop stopColor="#FFF0BC" /><Stop offset=".45" stopColor="#EBC07B" /><Stop offset=".8" stopColor="#C8874C" /><Stop offset="1" stopColor="#87503A" stopOpacity=".15" /></LinearGradient></Defs>
    <G transform={alternate ? 'translate(300 0) scale(-1 1)' : undefined}>
      <Path d="M66 366c-84-51-19-104-50-159 40 26 29 61 55 71-9-79 60-85 19-186 47 34 25 91 50 120 7-78 61-95 48-201 55 76-14 117 13 181 19-43 37-42 37-92 39 72-27 90-4 137 14-23 13-42 30-66-5 77 45 108 15 157-35 58-141 82-213 38z" fill="url(#living-fire)" opacity=".9" />
      <Path d="M88 360c-38-30-22-71-34-98 35 27 21 51 44 65 8-45 36-64 24-115 40 28 12 61 31 81-1-65 44-90 30-151 44 61-14 99 15 138 9-21 20-27 28-54 8 55 46 84 12 124-36 40-114 36-150 10z" fill="#F5D191" opacity=".87" />
      <Path d="M121 360c-22-26 20-45 17-77 31 19 13 35 24 45 9-23 16-43 15-65 35 36 8 66 28 74-7 46-62 51-84 23z" fill="#FFF0C5" />
      <G fill="none" stroke="#F7DDA4" strokeWidth="2" opacity=".55"><Path d="M48 260c-23-43 13-63-4-104m86 46c-30-70 42-99 18-157m83 244c-19-58 37-92 32-119" /></G>
    </G>
  </Svg>;
}

export function RitualEngravingArt() {
  return <Svg width={600} height={420} viewBox="0 0 600 420">
    <G fill="none" stroke="#61482C" strokeWidth="1.3" opacity=".7"><Path d="M22 91V22h115m326 0h115v69M22 329v69h115m326 0h115v-69M144 22h312M144 398h312" />
      <Path d="M31 80V31h96m346 0h96v49M31 340v49h96m346 0h96v-49M34 53c40-35 52 12 17 8-31-4-11-29 18-17m462 0c29-12 49 13 18 17-35 4-23-43 17-8" />
      <Path d="m280 48-7-14 19 5 8-18 8 18 19-5-7 14zM280 58h40v23c0 13-20 25-20 25s-20-12-20-25zM292 67v20h11m-1-22v18c17 0 17-20 0-16" />
      {Array.from({ length: 7 }, (_, i) => <G key={i} transform={`translate(76 ${140 + i * 27})`}><Path d={`M0 0q6-16 12-3l3 6 7-8q6-6 10 5l5-12q4 9 9 8m8 0q4-13 11-2l4 5 8-7q5-9 9 3m10 0q8-13 15-1l8-4 6 5m9-2q8-14 14-3l7 5 8-7 9 4m14-1q4-16 10-4l5 8 10-9 7 2m13 2q6-13 15-1l5-7q10 7 17 4${i < 5 ? 'm14 0q10-13 18-3l6 7 8-9 5 3m12 0q7-12 17-3l6 5 8-7' : ''}`} /></G>)}
      <Path d="M374 349c27-38 21 38 44 0 12-19 8 17 33-1m-87 16c31-11 64 11 99-3" />
    </G>
  </Svg>;
}

export function CharredEdgeArt() {
  return <Svg width={600} height={44} viewBox="0 0 600 44">
    <Path d="M0 9l13-5 10 7 8-8 14 8 13-6 13 7 12-8 17 5 10-7 13 9 12-5 15 6 17-9 17 6 9-7 19 7 14-6 13 7 19-7 13 9 14-7 18 8 13-11 18 8 13-4 17 7 10-9 14 8 16-5 16 7 17-9 19 6 12-7 15 9 15-6 16 6 14-8 14 7 14-5 15 6v23H0z" fill="#30241E" />
    <Path d="M0 19c26-15 41 7 64-4s31 10 51-1 28 9 46 0 23 9 44 0 22 10 45 0 20 10 42 0 28 10 47 0 21 10 41 0 30 10 46 0 22 10 42 0 31 10 50 0 22 10 42 0 22 10 40 0" fill="none" stroke="#D49143" strokeWidth="3" /><Path d="M0 20c26-15 41 7 64-4s31 10 51-1 28 9 46 0 23 9 44 0 22 10 45 0 20 10 42 0 28 10 47 0 21 10 41 0 30 10 46 0 22 10 42 0 31 10 50 0 22 10 42 0 22 10 40 0" fill="none" stroke="#F4CF83" strokeWidth=".8" />
  </Svg>;
}

export function AshPileArt() {
  const noise = (seed: number) => { const n = Math.sin(seed * 12.9898) * 43758.5453; return n - Math.floor(n); };
  return <Svg width={300} height={70} viewBox="0 0 300 70">
    <Defs><RadialGradient id="ash-shadow"><Stop stopColor="#211C20" stopOpacity=".6" /><Stop offset="1" stopColor="#211C20" stopOpacity="0" /></RadialGradient></Defs>
    <Ellipse cx="150" cy="46" rx="139" ry="22" fill="url(#ash-shadow)" />
    <Path d="M43 47c19-8 43-3 53-9 24-10 39-2 57-6 18-5 32 4 47 4 23-1 37 6 58 10-32 7-60 4-90 9-37-4-80 4-125-8z" fill="#645750" opacity=".7" />
    <G>{Array.from({ length: 145 }, (_, i) => {
      const angle = noise(i * 5 + 1) * Math.PI * 2; const radius = Math.sqrt(noise(i * 5 + 2));
      const x = 150 + Math.cos(angle) * radius * 124; const y = 43 + Math.sin(angle) * radius * 13;
      const size = 1.2 + noise(i * 5 + 3) * 5; const turn = noise(i * 5 + 4) * 180;
      return <Path key={i} d={`m${x} ${y} ${size * .3} ${-size * .6} ${size * .65} ${size * .1} ${size * .4} ${size * .6} ${-size * .8} ${size * .24}z`} transform={`rotate(${turn} ${x} ${y})`} fill={['#75685F', '#A49483', '#4A4140', '#B6A48A', '#8E7E71'][i % 5]} opacity={.55 + noise(i + 300) * .4} />;
    })}</G>
    <G fill="#E3A355" opacity=".65"><Circle cx="121" cy="42" r="1.3" /><Circle cx="164" cy="48" r=".8" /><Circle cx="188" cy="38" r="1.1" /></G>
  </Svg>;
}
