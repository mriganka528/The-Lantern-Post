import { MAX_VOICE_BYTES, MAX_VOICE_MS } from './voice-limits';
import type { VoiceMime } from './voice-limits';

// Bounded container validation for the two formats emitted by our recorders.
// This checks actual packet/sample timing rather than trusting client duration.
// Speech/content approval remains a separate, fail-closed moderation boundary.
export function inspectVoice(bytes: Uint8Array, mime: VoiceMime): number {
  if (bytes.length < 64 || bytes.length > MAX_VOICE_BYTES) throw new Error('Invalid audio size');
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const duration = mime === 'audio/webm' ? webmDuration(buffer) : mp4Duration(buffer);
  if (!Number.isFinite(duration) || duration < 900 || duration > MAX_VOICE_MS + 500) throw new Error('Invalid audio duration');
  return Math.min(MAX_VOICE_MS, Math.max(1000, Math.round(duration)));
}
function webmDuration(b: Buffer): number {
  let elements = 0;
  const vint = (offset: number, isId = false) => {
    if (offset >= b.length || b[offset] === 0) throw new Error('Invalid EBML');
    let width = 1; let mask = 128; while (!(b[offset]! & mask)) { width++; mask >>= 1; }
    if (width > (isId ? 4 : 8) || offset + width > b.length) throw new Error('Invalid EBML integer');
    let value = isId ? b[offset]! : b[offset]! & (mask - 1); let unknown = !isId && value === mask - 1;
    for (let i = 1; i < width; i++) { value = value * 256 + b[offset + i]!; unknown = unknown && b[offset + i] === 255; }
    if (!unknown && !Number.isSafeInteger(value)) throw new Error('Oversized EBML');
    return { value: unknown ? -1 : value, width };
  };
  const element = (offset: number, end: number) => {
    if (++elements > 100_000) throw new Error('Too many audio elements');
    const id = vint(offset, true); const size = vint(offset + id.width); const start = offset + id.width + size.width;
    const finish = size.value === -1 ? end : start + size.value;
    if (finish > end || finish < start) throw new Error('Truncated audio'); return { id: id.value, start, end: finish, unknown: size.value === -1 };
  };
  const uint = (start: number, end: number) => { if (end - start > 6 || end <= start) throw new Error('Invalid audio integer'); let value = 0; for (let i = start; i < end; i++) value = value * 256 + b[i]!; return value; };
  const header = element(0, b.length); if (header.id !== 0x1a45dfa3 || header.unknown) throw new Error('Not WebM');
  let docType = ''; for (let p = header.start; p < header.end;) { const e = element(p, header.end); if (e.unknown) throw new Error('Invalid WebM header'); if (e.id === 0x4282) docType = b.toString('ascii', e.start, e.end); p = e.end; }
  if (docType !== 'webm') throw new Error('Unsupported container');
  const segment = element(header.end, b.length); if (segment.id !== 0x18538067) throw new Error('Missing WebM segment');
  let scale = 1_000_000; let audioTrack = 0; let trackCount = 0; let latest = 0; let packetTotal = 0; let packets = 0;
  const block = (start: number, end: number, clock: number) => {
    const track = vint(start); const p = start + track.width;
    if (track.value !== audioTrack || p + 4 > end || (b[p + 2]! & 6) !== 0) throw new Error('Unsupported audio block');
    const toc = b[p + 3]!; const config = toc >> 3; const frame = config >= 16 ? 2.5 * 2 ** (config & 3) : config >= 12 ? 10 * 2 ** (config & 1) : [10, 20, 40, 60][config & 3]!;
    const code = toc & 3; if (code === 3 && p + 4 >= end) throw new Error('Truncated Opus packet');
    const count = code === 0 ? 1 : code === 3 ? b[p + 4]! & 63 : 2; const duration = frame * count;
    if (!count || duration > 120) throw new Error('Invalid Opus timing');
    packetTotal += duration; packets++; latest = Math.max(latest, (clock + b.readInt16BE(p)) * scale / 1_000_000 + duration);
    if (packets > 20000 || packetTotal > MAX_VOICE_MS + 500 || latest > MAX_VOICE_MS + 500) throw new Error('Recording too long');
  };
  for (let p = segment.start; p < segment.end;) {
    const e = element(p, segment.end); if (e.unknown && e.id !== 0x1f43b675) throw new Error('Unsupported indefinite element');
    if (e.id === 0x1549a966) { for (let q = e.start; q < e.end;) { const part = element(q, e.end); if (part.id === 0x2ad7b1) scale = uint(part.start, part.end); q = part.end; } if (scale < 1 || scale > 1_000_000_000) throw new Error('Invalid time scale'); }
    if (e.id === 0x1654ae6b) {
      for (let q = e.start; q < e.end;) {
        const track = element(q, e.end); q = track.end; if (track.id !== 0xae) continue;
        trackCount++; let number = 0; let type = 0; let codec = '';
        for (let r = track.start; r < track.end;) { const part = element(r, track.end); if (part.id === 0xd7) number = uint(part.start, part.end); if (part.id === 0x83) type = uint(part.start, part.end); if (part.id === 0x86) codec = b.toString('ascii', part.start, part.end); r = part.end; }
        if (type !== 2 || codec !== 'A_OPUS' || number < 1) throw new Error('Only Opus audio is accepted'); audioTrack = number;
      }
    }
    if (e.id === 0x1f43b675) {
      if (!audioTrack || trackCount !== 1) throw new Error('Missing audio track'); let clock = 0; let q = e.start;
      for (; q < e.end;) {
        const part = element(q, e.end); if (e.unknown && part.id === 0x1f43b675) break;
        if (part.unknown) throw new Error('Invalid cluster element');
        if (part.id === 0xe7) clock = uint(part.start, part.end);
        if (part.id === 0xa3) block(part.start, part.end, clock);
        if (part.id === 0xa0) for (let r = part.start; r < part.end;) { const item = element(r, part.end); if (item.id === 0xa1) block(item.start, item.end, clock); r = item.end; }
        q = part.end;
      }
      p = q;
    } else p = e.end;
  }
  if (!packets) throw new Error('Empty recording'); return Math.max(latest, packetTotal);
}
function mp4Duration(b: Buffer): number {
  type Box = { type: string; start: number; end: number };
  let count = 0;
  const boxes = (start: number, end: number): Box[] => {
    const result: Box[] = [];
    for (let p = start; p < end;) {
      if (++count > 100_000 || p + 8 > end) throw new Error('Invalid MP4');
      let size = b.readUInt32BE(p); let header = 8;
      if (size === 1) { if (p + 16 > end) throw new Error('Truncated MP4'); size = Number(b.readBigUInt64BE(p + 8)); header = 16; }
      if (!size) size = end - p;
      if (!Number.isSafeInteger(size) || size < header || p + size > end) throw new Error('Invalid MP4 size');
      result.push({ type: b.toString('ascii', p + 4, p + 8), start: p + header, end: p + size }); p += size;
    }
    return result;
  };
  const need = (box: Box | undefined, bytes: number): Box => { if (!box || box.end - box.start < bytes) throw new Error('Missing MP4 audio metadata'); return box; };
  const top = boxes(0, b.length); const ftyp = need(top.find(x => x.type === 'ftyp'), 8); const brand = b.toString('ascii', ftyp.start, ftyp.start + 4); if (!['M4A ', 'isom', 'mp41', 'mp42', 'qt  '].includes(brand) && !/^iso[2-9]$/.test(brand)) throw new Error('Unsupported MP4');
  const moov = need(top.find(x => x.type === 'moov'), 8); const children = boxes(moov.start, moov.end); const tracks = children.filter(x => x.type === 'trak');
  if (tracks.length !== 1 || !top.some(x => x.type === 'mdat' && x.end > x.start)) throw new Error('Only a single audio track is accepted');
  const track = tracks[0]!; const trackChildren = boxes(track.start, track.end); const mdia = need(trackChildren.find(x => x.type === 'mdia'), 8); const media = boxes(mdia.start, mdia.end);
  const handler = need(media.find(x => x.type === 'hdlr'), 12); if (b.toString('ascii', handler.start + 8, handler.start + 12) !== 'soun') throw new Error('Not an audio track');
  const mdhd = need(media.find(x => x.type === 'mdhd'), 24); const version = b[mdhd.start]; const scaleOffset = version === 1 ? 20 : 12;
  if (version !== 0 && version !== 1) throw new Error('Unsupported MP4 version'); need(mdhd, version === 1 ? 32 : 24);
  const scale = b.readUInt32BE(mdhd.start + scaleOffset); if (scale < 8000 || scale > 192000) throw new Error('Invalid audio clock');
  const minf = need(media.find(x => x.type === 'minf'), 8); const stbl = need(boxes(minf.start, minf.end).find(x => x.type === 'stbl'), 8); const tables = boxes(stbl.start, stbl.end);
  const stsd = need(tables.find(x => x.type === 'stsd'), 16); if (b.readUInt32BE(stsd.start + 4) !== 1) throw new Error('Unsupported sample descriptions');
  const sample = need(boxes(stsd.start + 8, stsd.end)[0], 28); if (sample.type !== 'mp4a') throw new Error('Only AAC audio is accepted');
  const channels = b.readUInt16BE(sample.start + 16); if (channels < 1 || channels > 2) throw new Error('Unsupported channels');
  let ticks = 0;
  const stts = tables.find(x => x.type === 'stts');
  if (stts) { need(stts, 8); const entries = b.readUInt32BE(stts.start + 4); if (entries > 20000 || stts.start + 8 + entries * 8 > stts.end) throw new Error('Invalid sample timing');
    for (let i = 0; i < entries; i++) ticks += b.readUInt32BE(stts.start + 8 + i * 8) * b.readUInt32BE(stts.start + 12 + i * 8);
  }
  if (!ticks) {
    let defaultDuration = 0; const mvex = children.find(x => x.type === 'mvex');
    if (mvex) { const trex = boxes(mvex.start, mvex.end).find(x => x.type === 'trex'); if (trex) { need(trex, 20); defaultDuration = b.readUInt32BE(trex.start + 12); } }
    for (const moof of top.filter(x => x.type === 'moof')) for (const traf of boxes(moof.start, moof.end).filter(x => x.type === 'traf')) {
      const parts = boxes(traf.start, traf.end); const tfhd = need(parts.find(x => x.type === 'tfhd'), 8); const flags = b.readUIntBE(tfhd.start + 1, 3); let p = tfhd.start + 8; let duration = defaultDuration;
      if (flags & 1) p += 8; if (flags & 2) p += 4; if (flags & 8) { if (p + 4 > tfhd.end) throw new Error('Invalid fragment'); duration = b.readUInt32BE(p); }
      for (const trun of parts.filter(x => x.type === 'trun')) {
        need(trun, 8); const flags = b.readUIntBE(trun.start + 1, 3); const samples = b.readUInt32BE(trun.start + 4); if (samples > 20000) throw new Error('Too many samples'); let cursor = trun.start + 8;
        if (flags & 1) cursor += 4; if (flags & 4) cursor += 4;
        for (let i = 0; i < samples; i++) { let sampleDuration = duration; if (flags & 0x100) { if (cursor + 4 > trun.end) throw new Error('Truncated sample'); sampleDuration = b.readUInt32BE(cursor); cursor += 4; }
          if (flags & 0x200) cursor += 4; if (flags & 0x400) cursor += 4; if (flags & 0x800) cursor += 4;
          if (cursor > trun.end || !sampleDuration) throw new Error('Invalid sample duration'); ticks += sampleDuration;
        }
      }
    }
  }
  return ticks / scale * 1000;
}
