import { useId } from 'react';
import type { CharacterKey } from '@lantern-post/shared-types';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from './svg-elements';
import { palettes } from '../src/storybook/palettes';
import { SceneryBackdrop, SceneryForeground } from './scenery-art';
import { isRoyalCharacter, RoyalPalaceDetails } from './royal-collection-art';

export function PalaceArt({ characterKey }: { characterKey: CharacterKey }) {
  const uid = useId().replace(/:/g, '');
  const p = palettes[characterKey];
  const moon = characterKey === 'rabbit-moon' || characterKey === 'cat-astral' || characterKey === 'owl-scholar';
  const rose = characterKey === 'deer-dawn';
  const cloud = characterKey === 'swan-cloud';
  const cat = characterKey === 'cat-astral';
  const owl = characterKey === 'owl-scholar';
  const stroke = '#97805B';
  return <Svg width={1200} height={660} viewBox="0 0 1200 660">
    <Defs>
      <LinearGradient id={`${uid}sky`} x2="0" y2="1"><Stop stopColor={p.sky} /><Stop offset=".75" stopColor={p.mist} /></LinearGradient>
      <LinearGradient id={`${uid}stone`} x2="1" y2="1"><Stop stopColor={p.mist} /><Stop offset=".55" stopColor={p.wall} /><Stop offset="1" stopColor={p.shade} /></LinearGradient>
      <LinearGradient id={`${uid}roof`} x2="0" y2="1"><Stop stopColor={p.roof} /><Stop offset="1" stopColor={p.accent} /></LinearGradient>
      <RadialGradient id={`${uid}light`}><Stop stopColor="#FFFEED" stopOpacity=".95" /><Stop offset="1" stopColor="#FFFEED" stopOpacity="0" /></RadialGradient>
      <LinearGradient id={`${uid}room`} x2="0" y2="1"><Stop stopColor="#FFF3CF" /><Stop offset="1" stopColor={p.shade} /></LinearGradient>
    </Defs>
    <Rect width="1200" height="660" fill={`url(#${uid}sky)`} />
    <Circle cx="600" cy="190" r="340" fill={`url(#${uid}light)`} />
    <G fill="none" stroke={stroke} opacity=".12" strokeWidth=".8">
      <Circle cx="600" cy="287" r="280" /><Circle cx="600" cy="287" r="270" />
      {Array.from({ length: 24 }, (_, i) => <Path key={i} d="M600 0v18" transform={`rotate(${i * 15} 600 287)`} />)}
    </G>
    {moon ? <Path d="M666 68a53 53 0 1 1-54-55 44 44 0 0 0 54 55" fill="#FFFAE3" stroke="#D9CBA8" strokeWidth="1" /> : <><Circle cx="600" cy="91" r="39" fill="#FBF2CD" /><Circle cx="600" cy="91" r="47" fill="none" stroke="#CDB579" opacity=".55" /></>}
    <G fill={p.mist} opacity=".72">
      <Path d="M-50 176c73-25 99-54 174-23 49-56 109-63 154-29 61-17 96 6 100 34 63-21 138-5 143 31H-50z" />
      <Path d="M812 174c35-52 80-49 118-24 41-67 114-70 150-31 38-16 106-3 100 29 65-3 88 18 85 38H793z" />
    </G>
    <G stroke={stroke} strokeWidth=".8" fill="none" opacity=".5">
      {[ [216, 88], [309, 53], [829, 69], [973, 83], [1059, 198], [159, 253], [384, 177], [782, 182] ].map(([x, y], i) => <Path key={i} d={`M${x} ${Number(y) - 7}v14m-7-7h14`} />)}
    </G>
    <G fill={p.shade} opacity=".17"><Path d="M0 426 70 383 123 403 205 307 281 387 332 356 410 430zM850 430l80-78 33 25 62-61 107 93 68-33v116z" /></G>
    <G fill={p.roof} opacity=".16">
      <Path d="M111 418v-94h45v94m-48-97 26-51 26 51M1047 429V312h40v117m-44-120 24-60 25 60M169 430v-68h30v68m-35-71 21-44 19 44" />
    </G>
    <Path d="M0 471c189-85 276 0 399-38 165-50 266-10 357 14 140-63 272-16 444 17v196H0z" fill={p.mist} />
    <SceneryBackdrop />
    <Ellipse cx="600" cy="516" rx="411" ry="79" fill={p.shade} opacity=".25" />
    <G stroke={stroke} strokeWidth="1.3" strokeLinejoin="round">
      <Path d="M261 497v-171l116-12v183M823 497V314l116 12v171" fill={`url(#${uid}stone)`} />
      <Path d="m254 326 79-68 57 68zm556 0 57-68 78 68z" fill={`url(#${uid}roof)`} />
      <Rect x="377" y="272" width="446" height="225" fill={`url(#${uid}stone)`} />
      <Path d="m354 278 93-103h306l93 103z" fill={`url(#${uid}roof)`} />
      <Path d="M382 258h436M403 235h394M422 214h357M441 193h318" fill="none" opacity=".35" />
      <Path d="M377 279h446v13H377zM371 482h458v17H371z" fill={p.wall} />
      <Path d="M470 482V263c0-170 260-170 260 0v219" fill={`url(#${uid}stone)`} />
      <Path d="M466 267c0-174 268-174 268 0M484 267c0-151 232-151 232 0" fill="none" strokeWidth="4" />
      <Path d="M491 480V282c0-143 218-143 218 0v198" fill={`url(#${uid}room)`} />
      <Path d="M502 482V283c0-128 196-128 196 0v199" fill="none" stroke={p.shade} strokeWidth="3" />
      <G fill={p.wall}><Path d="M469 283h26v192h-26zM705 283h26v192h-26z" /><Path d="M461 276h43v13h-43zm236 0h43v13h-43zM461 470h43v16h-43zm236 0h43v16h-43z" /></G>
      <G fill="none" opacity=".35"><Path d="M479 294v165m7-165v165m229-165v165m7-165v165" /></G>
      <Path d="M525 404V286c0-98 150-98 150 0v118" fill={p.sky} stroke={p.shade} />
      <Path d="M535 394V286c0-83 130-83 130 0v108" fill={p.mist} opacity=".58" />
      <Path d="M600 215v189M527 283h146M527 330h146m-124-94 51 47 51-47" fill="none" stroke={p.shade} strokeWidth="3" />
      <Path d="M523 407h154v9H523" fill={p.wall} />
      <Path d="M517 411h166l22 68H494z" fill={p.wall} />
      <G fill="none" opacity=".35"><Path d="M517 434h166m-177 19h188m-94-37v62m-43-67-19 68m105-68 20 68" /></G>
      {/* A tiny, inviting writing desk in the open central room. */}
      <Path d="M551 404h100v9H551zm7 9h8v43h-8zm78 0h8v43h-8z" fill="#B3976C" /><Path d="M574 412h50v21h-50z" fill="#CAB38C" /><Circle cx="599" cy="423" r="2" fill={stroke} />
      <Path d="m578 401 20-6 14 7z" fill="#FFF5D7" /><Path d="M624 402v-30c0-10 11-22 16-22 2 14-5 27-16 26" fill={p.mist} />
      {owl && <G fill={p.accent}><Path d="M512 347h25v51h-25M663 347h25v51h-25" />{[0, 1, 2, 3].map(i => <Path key={i} d={`M${515 + i * 5} 353v37m${149} -37v37`} stroke={p.wall} strokeWidth="3" />)}</G>}
      {cat && <G fill="none" stroke={p.accent}><Circle cx="600" cy="258" r="23" /><Ellipse cx="600" cy="258" rx="9" ry="23" transform="rotate(32 600 258)" /><Path d="m573 272 53-28M600 235v-11m0 57v11" /></G>}
      {[321, 433, 767, 879].map((x, index) => <G key={x}>
        <Path d={`M${x - 18} 424v-65a18 18 0 0 1 36 0v65z`} fill={p.sky} /><Path d={`M${x - 13} 420v-61a13 13 0 0 1 26 0v61z`} fill="#FDF1CE" opacity=".65" />
        <Path d={`M${x} 343v81m-18-37h36m-40 42h44`} fill="none" /><Circle cx={x} cy={index === 0 || index === 3 ? 319 : 311} r="6" fill={p.shade} />
      </G>)}
      {[374, 826].map((x) => <G key={x}>
        <Path d={`M${x - 29} 474V223h58v251`} fill={`url(#${uid}stone)`} />
        <Path d={`m${x - 43} 228 43-99 43 99z`} fill={`url(#${uid}roof)`} />
        <Path d={`M${x} 126V97m-5 9h10`} fill="none" /><Circle cx={x} cy="94" r="3" fill="#C5AB6F" />
        <Path d={`M${x - 35} 228h70v10h-70zM${x - 33} 452h66v14h-66z`} fill={p.wall} />
        <Path d={`M${x - 11} 306v-36a11 11 0 0 1 22 0v36z`} fill={p.sky} /><Path d={`M${x} 261v45m-12-20h24`} fill="none" />
        <Path d={`M${x - 20} 341h40m-40 39h40m-40 39h40`} opacity=".18" />
      </G>)}
      <Path d="M455 489h290v13H455zm-16 13h322v13H439zm-18 13h358v14H421z" fill={p.wall} />
      <Path d="m505 529-89 131h368l-90-131z" fill="#EFE4CD" stroke={p.shade} />
      <G fill="none" opacity=".4"><Path d="M485 558h229m-251 31h271m-294 34h316m-156-94v131M551 529l-35 131m133-131 35 131" /></G>
      <G fill={p.foliage} stroke={p.foliage}>
        {[170, 300, 901, 1030].map((x, i) => <G key={x}><Path d={`M${x} 501v-80`} /><Ellipse cx={x} cy={429 - (i % 2) * 15} rx="23" ry="41" opacity=".8" /><Path d={`M${x - 21} 483h42l-7 32h-28z`} fill={p.wall} stroke={stroke} /><Path d={`M${x - 24} 482h48v7h-48z`} fill={p.shade} stroke={stroke} /></G>)}
      </G>
      {/* Each palace has its own botanical/celestial details. */}
      {rose && <G fill="none" stroke={p.foliage} strokeWidth="3"><Path d="M442 479c-15-60 19-103 8-157s10-102 47-132M753 479c19-60-19-103-8-157s-10-102-47-132" />{[231, 273, 319, 371, 424].map((y, i) => <G key={y}><Circle cx={453 - i % 2 * 10} cy={y} r="9" fill="#D7A8A1" stroke="#B88A80" /><Circle cx={743 + i % 2 * 10} cy={y + 10} r="8" fill="#E4BCB2" stroke="#B88A80" /></G>)}</G>}
      {cloud && <G><Ellipse cx="893" cy="546" rx="69" ry="13" fill={p.sky} /><Path d="M842 542c23 12 68 12 100 0l-9 14h-80z" fill={p.wall} /><Path d="M890 541c-10-5-18-12-13-19 10-15 23-9 14-32-4-10 7-16 13-9 7 8-3 10-6 7 16 29 29 17 24 37-3 11-21 17-32 16z" fill="#FFFCEE" /></G>}
      {characterKey === 'rabbit-moon' && <G fill="#EFE8F0" stroke={p.foliage}>{[212, 274, 924, 994].map(x => <G key={x}><Path d={`M${x} 553v-22`} /><Path d={`M${x} 532c-25-15-7-22 0-12 8-15 24-2 0 12z`} /></G>)}</G>}
    </G>
    {isRoyalCharacter(characterKey) && <RoyalPalaceDetails characterKey={characterKey} />}
    <G fill={p.foliage} opacity=".58">
      <Path d="M0 577c91-31 118-67 203-44 58-29 104 0 133 34 38-6 78 1 91 27H0zM1200 577c-91-31-118-67-203-44-58-29-104 0-133 34-38-6-78 1-91 27h427z" />
    </G>
    <G fill={p.mist}>
      <Path d="M-34 599c48-59 129-37 133-13 43-73 139-52 146-14 68-37 141-6 139 28 51-9 107 13 119 60H0z" />
      <Path d="M1234 599c-48-59-129-37-133-13-43-73-139-52-146-14-68-37-141-6-139 28-51-9-107 13-119 60h503z" />
    </G>
    <G fill="none" stroke={stroke} opacity=".22"><Path d="M0 633c75-33 119 14 181-8s109-17 163 9M1200 633c-75-33-119 14-181-8s-109-17-163 9M92 591c27-16 59-6 73 8M1035 599c27-17 59-13 73-8" /></G>
    <SceneryForeground />
    {/* Sparse etched grain, deterministic and small enough for mobile. */}
    <G stroke={stroke} opacity=".07" strokeWidth=".8">{Array.from({ length: 210 }, (_, i) => {
      const x = (i * 137 + 31) % 1200; const y = (i * 89 + 43) % 660;
      return <Path key={i} d={`M${x} ${y}h${i % 3 + 1}`} />;
    })}</G>
  </Svg>;
}
