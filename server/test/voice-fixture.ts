import type { VoiceStorageService } from '../src/voice/voice-storage.service';
function ebml(id: string, data: Buffer) {
  const size = data.length < 127 ? Buffer.from([128 | data.length]) : data.length < 16383 ? Buffer.from([64 | (data.length >> 8), data.length & 255]) : Buffer.from([32 | (data.length >> 16), (data.length >> 8) & 255, data.length & 255]);
  return Buffer.concat([Buffer.from(id, 'hex'), size, data]);
}
export function syntheticWebm(milliseconds = 2000) {
  const header = ebml('1a45dfa3', ebml('4282', Buffer.from('webm')));
  const tracks = ebml('1654ae6b', ebml('ae', Buffer.concat([ebml('d7', Buffer.from([1])), ebml('83', Buffer.from([2])), ebml('86', Buffer.from('A_OPUS'))])));
  const blocks: Buffer[] = [ebml('e7', Buffer.from([0]))];
  for (let time = 0; time < milliseconds; time += 20) { const block = Buffer.alloc(7); block[0] = 0x81; block.writeInt16BE(time % 30000, 1); block[3] = 0x80; block[4] = 0x98; blocks.push(ebml('a3', block)); }
  return Buffer.concat([header, ebml('18538067', Buffer.concat([tracks, ebml('1f43b675', Buffer.concat(blocks))]))]);
}
function box(type: string, ...parts: Buffer[]) { const data = Buffer.concat(parts); const head = Buffer.alloc(8); head.writeUInt32BE(data.length + 8); head.write(type, 4, 'ascii'); return Buffer.concat([head, data]); }
export function syntheticM4a() {
  const mdhd = Buffer.alloc(24); mdhd.writeUInt32BE(24000, 12); mdhd.writeUInt32BE(48000, 16);
  const hdlr = Buffer.alloc(16); hdlr.write('soun', 8, 'ascii');
  const sample = Buffer.alloc(28); sample.writeUInt16BE(1, 16); sample.writeUInt16BE(16, 18); sample.writeUInt32BE(24000 * 65536, 24);
  const desc = Buffer.alloc(8); desc.writeUInt32BE(1, 4);
  const timing = Buffer.alloc(16); timing.writeUInt32BE(1, 4); timing.writeUInt32BE(50, 8); timing.writeUInt32BE(960, 12);
  return Buffer.concat([box('ftyp', Buffer.from('M4A \0\0\0\0isom')), box('moov', box('trak', box('mdia', box('mdhd', mdhd), box('hdlr', hdlr), box('minf', box('stbl', box('stsd', desc, box('mp4a', sample)), box('stts', timing)))))), box('mdat', Buffer.alloc(128, 1))]);
}
export function memoryVoiceStorage() {
  const objects = new Map<string, Uint8Array>(); const calls: { kind: string; key: string }[] = [];
  let enabled = true; let failDelete = false; let beforePut: (() => Promise<void>) | null = null;
  const storage: Pick<VoiceStorageService, 'available' | 'upload' | 'read' | 'put' | 'playback' | 'remove'> = {
    get available() { return enabled; },
    upload: (key, _bytes, _mime, seconds = 600) => ({ url: `https://voice.example.invalid/upload/${key}`, expiresAt: new Date(Date.now() + seconds * 1000) }),
    read: async (key, expected) => { calls.push({ kind: 'read', key }); const bytes = objects.get(key); if (!bytes || bytes.length !== expected) throw new Error('Synthetic incomplete upload'); return bytes.slice(); },
    put: async (key, bytes) => { if (beforePut) await beforePut(); calls.push({ kind: 'put', key }); objects.set(key, bytes.slice()); },
    playback: key => ({ url: `https://voice.example.invalid/play/${key}`, expiresAt: new Date(Date.now() + 300_000) }),
    remove: async key => { calls.push({ kind: 'remove', key }); if (failDelete) throw new Error('Synthetic storage outage'); objects.delete(key); },
  };
  return { storage, objects, calls, setEnabled: (value: boolean) => { enabled = value; }, setDeleteFailure: (value: boolean) => { failDelete = value; }, setBeforePut: (callback: (() => Promise<void>) | null) => { beforePut = callback; } };
}
