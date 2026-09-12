import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from './svg-elements';

export function FriendshipCourtArt() {
  return <Svg width={1400} height={360} viewBox="0 0 1400 360">
    <Defs><LinearGradient id="court-sky" x2="0" y2="1"><Stop stopColor="#C9D9D7" /><Stop offset=".65" stopColor="#E3E8DA" /><Stop offset="1" stopColor="#F2E7CF" /></LinearGradient><LinearGradient id="court-stone" x2="1" y2="1"><Stop stopColor="#E6D6B6" /><Stop offset=".55" stopColor="#C9B48F" /><Stop offset="1" stopColor="#A99371" /></LinearGradient></Defs>
    <Rect width="1400" height="360" fill="url(#court-sky)" />
    <Circle cx="700" cy="86" r="110" fill="#FAF1D4" opacity=".52" /><Circle cx="700" cy="86" r="126" fill="none" stroke="#C3AC70" opacity=".35" />
    <G fill="#F9F4E7" opacity=".74"><Path d="M0 133c95-53 181-36 221-2 87-49 160-48 230-6 51-63 158-35 199 0 101-42 176-24 230 7 93-49 153-30 189 2 127-62 253-38 331 3v44H0z" /><Path d="M0 285c110-57 179-28 219-4 124-58 174-24 269-2 77-29 135-36 215-1 91-42 184-31 240 7 96-65 176-39 230-9 91-33 170-38 227-2v86H0z" /></G>
    <G fill="none" stroke="#A9915D" opacity=".6">{Array.from({ length: 23 }, (_, i) => { const x = 60 + i * 59; const y = 23 + i * 37 % 110; return <Path key={i} d={`M${x} ${y - 4}v8m-4-4h8`} />; })}</G>
    <G fill="none" stroke="#AF9770" opacity=".45"><Path d="M403 216a297 220 0 0 1 594 0M433 222a267 191 0 0 1 534 0M381 289h640" /><Path d="M488 207V67m423 140V67M449 214v-98m501 98v-98" /></G>
    {[false, true].map(mirror => <G key={String(mirror)} transform={mirror ? 'translate(1400 0) scale(-1 1)' : undefined}>
      <G stroke="#A58E66" strokeWidth="1.5" fill="url(#court-stone)">
        <Path d="M50 360V69Q160-60 270 69v291h-35V83Q160-5 85 83v277z" />
        <Path d="M32 346h256v14H32zM56 74h24v271H56zM240 74h24v271h-24zM46 69h44v12H46zM230 69h44v12h-44z" />
        <Path d="M91 342V92q69-94 138 0v250z" fill="#9BAE9B" /><Path d="M100 342V99q60-87 120 0v243z" fill="#839987" />
        <Path d="M160 52v289M111 122v191h38V84M171 84v229h38V122M108 323h104" fill="none" stroke="#DCC99D" strokeWidth="2" />
        <Path d="m160 121 7 16 17 7-17 7-7 16-7-16-17-7 17-7z" fill="#DDCCA4" />
        <Circle cx="153" cy="222" r="4" fill="#EDDDB6" /><Circle cx="167" cy="222" r="4" fill="#EDDDB6" />
        <Path d="M42 88c70-117 165-117 236 0M33 332h57m141 0h57" fill="none" stroke="#F2E5C7" strokeWidth="2" />
      </G>
      <G fill="#748B73" stroke="#77866A" strokeWidth="1"><Path d="M24 353c44-83 6-94 46-173-13 99 16 117-9 180M271 360c-23-78 18-118-5-197 33 50 1 129 30 191" opacity=".85" />
        {Array.from({ length: 11 }, (_, i) => <G key={i} transform={`translate(${i % 2 ? 270 : 54} ${170 + i * 17}) rotate(${i % 2 ? -20 : 24})`}><Ellipse rx="15" ry="5" /><Ellipse cx="-13" cy="-9" rx="12" ry="4" transform="rotate(45 -13 -9)" /></G>)}
      </G>
      <G fill="#C8A5A0" stroke="#B58D83" strokeWidth=".7">{[[54, 205], [270, 247], [52, 304], [276, 188], [32, 338]].map(([x, y]) => <G key={x! + y!} transform={`translate(${x} ${y})`}><Path d="M0-9c8-9 13 0 9 5 13 4 9 15 1 13-4 11-15 5-12-2-12 1-13-10-4-11-4-7 3-13 6-5z" /><Circle r="3" fill="#E7C690" /></G>)}</G>
      <G fill="#E6D6B5" stroke="#A88F62" strokeWidth="1.5"><Path d="M329 292h39v50h-39zM319 279h60l-12 19h-36zM326 342h45v11h-45z" /><Path d="M348 280v-35m-8 7h16" fill="none" /><Circle cx="348" cy="241" r="8" fill="#EDDDAD" /></G>
    </G>)}
    <G stroke="#C8B18A" fill="none" strokeWidth="2"><Path d="M0 352h1400M304 337h168m456 0h168M304 315h168m456 0h168" />{[319, 362, 405, 448, 952, 995, 1038, 1081].map(x => <Path key={x} d={`M${x} 316v21`} />)}</G>
    <G fill="#AD936B" opacity=".27"><Path d="M544 360 614 232h172l70 128z" /></G>
    <G fill="#F9F4E8" stroke="#C0AC81" strokeWidth=".8"><Path d="M333 112c-25-28-46-5-10 8-24 7-18 31 5 11l14-5 16 8c19 23 32-4 5-12 28-11 16-36-10-11l-10 5z" /><Circle cx="343" cy="104" r="7" /><Path d="m343 113-13 28h26z" fill="#DFD5C8" /></G>
    <G transform="translate(1400 0) scale(-1 1)" fill="#F9F4E8" stroke="#C0AC81" strokeWidth=".8"><Path d="M333 112c-25-28-46-5-10 8-24 7-18 31 5 11l14-5 16 8c19 23 32-4 5-12 28-11 16-36-10-11l-10 5z" /><Circle cx="343" cy="104" r="7" /><Path d="m343 113-13 28h26z" fill="#DFD5C8" /></G>
  </Svg>;
}
