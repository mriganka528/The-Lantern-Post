import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from './svg-elements';

const sheet = 'M13 12L87 9 142 13 204 8 280 11 358 7 414 12 487 8 576 12 589 31 587 122 592 193 588 277 592 348 587 431 591 511 587 598 591 685 587 773 575 787 501 790 422 786 351 792 279 788 195 791 124 786 41 791 12 780 9 705 13 626 8 548 12 465 8 381 12 298 8 213 13 137 8 58Z';

export function PaperSilhouetteArt() {
  return <Svg width={600} height={800} viewBox="0 0 600 800"><Path d={sheet} fill="#FFFFFF" /></Svg>;
}

export function OldPaperTextureArt({ texture }: { texture: 'parchment' | 'linen' | 'vellum' }) {
  return <Svg width={600} height={800} viewBox="0 0 600 800">
    <Defs>
      <ClipPath id="sheet-mask"><Path d={sheet} /></ClipPath>
      <RadialGradient id="age"><Stop offset=".45" stopColor="#B17A36" stopOpacity="0" /><Stop offset=".88" stopColor="#9A6329" stopOpacity=".035" /><Stop offset="1" stopColor="#79431D" stopOpacity=".15" /></RadialGradient>
      <LinearGradient id="fold"><Stop stopColor="#AD7947" stopOpacity="0" /><Stop offset=".47" stopColor="#AD7947" stopOpacity="0" /><Stop offset=".5" stopColor="#FFF7D8" stopOpacity=".2" /><Stop offset=".51" stopColor="#6E4621" stopOpacity=".06" /><Stop offset=".55" stopColor="#AD7947" stopOpacity="0" /></LinearGradient>
    </Defs>
    <G clipPath="url(#sheet-mask)">
      <Rect width="600" height="800" fill="url(#age)" /><Rect width="600" height="800" fill="url(#fold)" />
      {[ [38, 102, 86, 35], [524, 640, 88, 43], [86, 740, 63, 20], [477, 67, 65, 43] ].map(([x, y, rx, ry], i) => <Ellipse key={i} cx={x} cy={y} rx={rx} ry={ry} fill="#987047" opacity=".035" />)}
      <G stroke="#744722" strokeWidth=".5" opacity={texture === 'linen' ? '.13' : '.08'}>
        {Array.from({ length: 1000 }, (_, i) => { const x = (i * 137 + 19) % 600; const y = (i * 83 + 41) % 800; return <Path key={i} d={`M${x} ${y}l${i % 5 + 1} ${i % 3 - 1}`} />; })}
      </G>
      {texture === 'linen' && <G stroke="#886745" strokeWidth=".45" opacity=".07">{Array.from({ length: 95 }, (_, i) => <Path key={i} d={`M0 ${i * 9}h600M${i * 9} 0v800`} />)}</G>}
      {texture === 'vellum' && <G fill="none" stroke="#8B6C40" strokeWidth=".5" opacity=".12"><Path d="M20 181c138 29 303-22 563 9M15 472c204-18 372 22 573 3M64 16c15 203-10 479 4 764" /></G>}
      <Path d={sheet} fill="none" stroke="#75471D" strokeWidth="2" opacity=".23" />
    </G>
  </Svg>;
}

function Corner({ motif }: { motif: string }) {
  return <G stroke="#9E7840" strokeWidth="1.2" fill="none" strokeLinecap="round">
    <Path d="M0 99V17Q0 0 17 0h83M8 88V20Q8 8 20 8h69M17 71V28Q17 17 28 17h44" />
    {motif === 'floral' ? <>
      <Path d="M15 79C44 74 12 43 48 25c19-12 35-1 41 6M29 58c13 3 20 14 9 17-10 2-13-12-9-17M33 45c-5-12 0-26 9-23 10 3 0 20-9 23M56 24c4-11 17-18 21-9 3 7-11 13-21 9" />
      <Path d="M64 45c-9-10 3-22 9-10 13-3 17 13 2 15-4 13-20 9-15-3z" /><Circle cx="70" cy="44" r="4" />
    </> : motif === 'stars' ? <>
      <Circle cx="44" cy="44" r="19" /><Circle cx="44" cy="44" r="23" strokeDasharray="1 5" />
      <Path d="m44 27 4 13 13 4-13 4-4 13-4-13-13-4 13-4zM79 23v15m-7-7h14M23 78h15m-8-7v14" />
    </> : motif === 'royal' ? <>
      <Path d="M27 75c25 3 36-22 16-27-20-4-22 20-4 18 20-3 22-35 35-37M38 35c-4-19 17-23 16-10-1 12-17 15-16 3M62 57c22-9 27 12 14 15-15 3-19-12-10-14" />
      <Path d="m53 41 6-15 6 15 14-7-7 18H48l-7-18z" fill="#9E7840" fillOpacity=".12" />
    </> : <>
      <Path d="M22 62V25h42v37zM28 55V32h30v23zM26 75c23-13 38 13 61 0M29 83c20-12 35 13 55 0" />
      <Path d="m43 35 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
    </>}
  </G>;
}

export function StationeryBorderArt({ motif }: { motif: 'stars' | 'floral' | 'royal' | 'postmark' }) {
  return <Svg width={600} height={800} viewBox="0 0 600 800">
    <G stroke="#9E7840" fill="none" strokeWidth=".75" opacity=".72"><Path d="M132 27h336M132 773h336M27 132v536M573 132v536" /><Path d="M139 34h322M139 766h322M34 139v522M566 139v522" strokeDasharray={motif === 'postmark' ? '3 5' : '1 5'} /></G>
    <G transform="translate(26 26)"><Corner motif={motif} /></G>
    <G transform="translate(574 26) scale(-1 1)"><Corner motif={motif} /></G>
    <G transform="translate(26 774) scale(1 -1)"><Corner motif={motif} /></G>
    <G transform="translate(574 774) scale(-1 -1)"><Corner motif={motif} /></G>
    <G stroke="#9E7840" fill="none" strokeWidth="1"><Path d="M249 747c21-14 35 16 51 0 17 16 30-14 51 0M289 747l11-8 11 8-11 8z" /><Circle cx="240" cy="747" r="2" /><Circle cx="360" cy="747" r="2" /></G>
  </Svg>;
}

export function PalaceCrestArt() {
  return <Svg width={140} height={140} viewBox="0 0 140 140">
    <G fill="none" stroke="#A27D3B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M49 40h42v40c0 17-21 29-21 29S49 97 49 80zM55 46h30v32c0 12-15 23-15 23S55 90 55 78z" />
      <Path d="m48 36-5-15 18 7 9-17 9 17 18-7-5 15zM70 7v6m-4-3h8M61 53v33h14M72 54v27m0-27c21-4 21 16 0 13" />
      <Path d="M48 106C22 95 17 64 31 46m-1 42-10-6m16 17-11-1m4-27-9-11m15-2-2-13m59 61c26-11 31-42 17-60m1 42 10-6m-16 17 11-1m-4-27 9-11m-15-2 2-13M40 113c21 1 26 12 30 12s13-11 30-12" />
      <Path d="M23 86c-9-6-15 0-8 5l13 1M21 69c-10-9-16-4-8 4l11 3M30 53c-4-12-12-12-10-2l6 9m91 26c9-6 15 0 8 5l-13 1m7-23c10-9 16-4 8 4l-11 3m-6-23c4-12 12-12 10-2l-6 9" />
    </G>
  </Svg>;
}

export function WoodGrainArt() {
  return <Svg width={1000} height={900} viewBox="0 0 1000 900">
    <Defs><LinearGradient id="wood"><Stop stopColor="#62422C" /><Stop offset=".5" stopColor="#79553A" /><Stop offset="1" stopColor="#4A3122" /></LinearGradient></Defs>
    <Rect width="1000" height="900" fill="url(#wood)" />
    <G fill="none" stroke="#28170D" opacity=".14">{Array.from({ length: 84 }, (_, i) => <Path key={i} d={`M${i * 13} 0c-23 137 31 220 0 355s29 283 3 545`} strokeWidth={i % 4 ? 1 : 3} />)}</G>
    <G fill="none" stroke="#CFA576" opacity=".11"><Path d="M18 0v900M985 0v900M2 14h996M2 885h996" strokeWidth="5" /><Path d="M451 0c-45 283 70 213 12 466s-20 332 0 434M789 0c38 172-35 353 0 490s-8 291 0 410" /></G>
  </Svg>;
}

export function WritingChamberArt() {
  return <Svg width={1400} height={360} viewBox="0 0 1400 360">
    <Defs><LinearGradient id="room"><Stop stopColor="#35271E" /><Stop offset=".6" stopColor="#624832" /><Stop offset="1" stopColor="#3D3027" /></LinearGradient><RadialGradient id="window-light"><Stop stopColor="#F1D9A2" stopOpacity=".35" /><Stop offset="1" stopColor="#F1D9A2" stopOpacity="0" /></RadialGradient></Defs>
    <Rect width="1400" height="360" fill="url(#room)" /><Ellipse cx="1130" cy="183" rx="260" ry="260" fill="url(#window-light)" />
    <G stroke="#A18154" strokeWidth="2" fill="none" opacity=".5"><Path d="M20 21h1360v318H20zM28 29h1344v302H28zM57 31v298M1341 31v298" /><Path d="M88 32v296M700 32v296M740 32v296" opacity=".25" /></G>
    <G stroke="#AB8C58" fill="#47372A" strokeWidth="2">
      <Path d="M955 306V147c0-163 270-163 270 0v159z" /><Path d="M976 306V150c0-137 228-137 228 0v156z" fill="#D3BE93" />
      <Path d="M1090 47v259M977 157h225M977 228h225m-190-117 78 49 78-49" fill="none" strokeWidth="4" />
      <Path d="M940 307h300v14H940z" fill="#7B6141" /><Path d="M950 39c-32 69-43 149-25 246l41-38c-22-87-14-155 6-200M1228 39c32 69 43 149 25 246l-41-38c22-87 14-155-6-200" fill="#766044" />
    </G>
    <G fill="#EFE0B3" opacity=".35"><Path d="M980 221c42-31 79-21 110-9 43-30 77-11 111-8v25H980z" /><Circle cx="1157" cy="102" r="17" /></G>
    <G stroke="#B9955C" fill="#4B3423" strokeWidth="1.5"><Path d="M779 253h123v11H779zm9 11h104v50H788z" />{[799, 815, 834, 855, 873].map((x, i) => <Rect key={x} x={x} y={193 + i % 2 * 9} width="14" height={60 - i % 2 * 9} fill={i % 2 ? '#8C7451' : '#635E45'} />)}<Path d="M1285 283v-99m-14 99h28m-28-83h28" /><Path d="M1278 184h15v-49h-15z" fill="#E9DAB5" /><Path d="M1285 116c-13 15-11 22 0 24 12-4 9-13 0-24z" fill="#E9BE69" /></G>
    <G fill="#DBBC7C" opacity=".2">{Array.from({ length: 38 }, (_, i) => <Circle key={i} cx={778 + i * 67 % 541} cy={43 + i * 41 % 281} r={i % 3 ? 1 : 2} />)}</G>
  </Svg>;
}

export function HearthArt() {
  return <Svg width={1000} height={650} viewBox="0 0 1000 650">
    <Defs><LinearGradient id="hearth-room" x2="0" y2="1"><Stop stopColor="#292326" /><Stop offset="1" stopColor="#534032" /></LinearGradient><RadialGradient id="ember-light"><Stop stopColor="#EBC57C" stopOpacity=".42" /><Stop offset="1" stopColor="#EBC57C" stopOpacity="0" /></RadialGradient></Defs>
    <Rect width="1000" height="650" fill="url(#hearth-room)" /><Ellipse cx="500" cy="449" rx="330" ry="300" fill="url(#ember-light)" />
    <G stroke="#9D8158" strokeWidth="1.6" fill="none" opacity=".65"><Path d="M34 32h932v586H34zM45 43h910v565H45zM123 44v562m751-562v562" /><Path d="M65 169V86h63M935 169V86h-63M65 489v85h63m807-85v85h-63" /></G>
    <G stroke="#B29B70" strokeWidth="2" fill="#7A6650">
      <Path d="M281 529V281c0-259 438-259 438 0v248z" /><Path d="M313 525V284c0-218 374-218 374 0v241z" fill="#514438" /><Path d="M339 519V288c0-183 322-183 322 0v231z" fill="#2E2824" />
      <Path d="M262 276h69v15h-69zm406 0h69v15h-69zM270 290h54v222h-54zm406 0h54v222h-54zM257 512h80v20h-80zm406 0h80v20h-80z" fill="#A38A65" />
      <Path d="M284 301v200m24-200v200m380-200v200m24-200v200" fill="none" stroke="#6A563D" /><Path d="M243 533h514v22H243zm-22 22h558v21H221z" fill="#B29870" />
      <Path d="m471 86-9-19 25 8 13-28 13 28 25-8-9 19zM463 94h74" fill="#BAA06B" /><Path d="M457 121c19-16 25 23 43 1 17 23 25-17 43-1M426 141c-12-28-30-11-11 0m171 0c12-28 30-11 11 0" fill="none" />
    </G>
    <G stroke="#A88E5B" fill="#7A5839" strokeWidth="2"><Path d="M404 467h192l-26 56H430z" /><Path d="M418 484c44 24 115 22 164 0M432 516h136m-127 7-12 12m130-12 12 12" fill="none" /><Path d="M450 452v-14m50 14v-23m50 23v-14" stroke="#D6B36E" /></G>
    <G stroke="#B69A64" strokeWidth="2" fill="#D4C49A">{[190, 810].map(x => <G key={x}><Path d={`M${x} 483V291m-24 192h48m-18-16h-12M${x - 9} 291h18v-60h-18z`} /><Path d={`M${x} 211c-14 16-11 24 0 25 12-3 11-10 0-25z`} fill="#E6BC6E" /></G>)}</G>
    <G fill="#D9BE83" opacity=".5">{Array.from({ length: 29 }, (_, i) => <Circle key={i} cx={134 + i * 71 % 745} cy={56 + i * 43 % 487} r={i % 5 ? 1 : 2} />)}</G>
  </Svg>;
}

export function FireArt({ alternate = false }: { alternate?: boolean }) {
  return <Svg width={300} height={240} viewBox="0 0 300 240">
    <Defs><LinearGradient id="flame" x2="0" y2="1"><Stop stopColor="#F9DEA3" /><Stop offset=".55" stopColor="#DB9D4E" /><Stop offset="1" stopColor="#A8532B" /></LinearGradient></Defs>
    <G transform={alternate ? 'translate(300 0) scale(-1 1)' : undefined}>
      <Path d="M72 213c-64-61 15-63-6-133 54 35 27 66 57 69 2-44-26-54 22-133 0 66 51 75 37 117 34-6 29-44 38-55 6 58 58 73 30 127-32 50-140 45-178 8z" fill="url(#flame)" opacity=".92" />
      <Path d="M104 218c-43-34-16-43-7-64 10 30 29 27 32 10 7-36 22-40 23-72 43 48 12 62 29 77 15 7 31-12 29-26 31 52-7 92-52 89-26-1-34-3-54-14z" fill="#F7CE84" />
      <Path d="M131 223c-23-24 10-39 12-58 27 18 23 27 32 34 16 22-19 38-44 24" fill="#FFF0C0" />
    </G>
  </Svg>;
}
