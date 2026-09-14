import { Asset } from 'expo-asset';
import type { ImageSourcePropType } from 'react-native';
import { paperBorders, paperTextures } from './antique-assets';
import { voiceStorage } from '../voice/voice-storage';
import { wrapLetter } from './share-contract';
import type { PreparedShare, ShareCopy, ShareResult } from './share-contract';
export const fileSharingAvailable = true;
export const fileSharingNote = 'Choose a compatible app, or save a copy to attach anywhere. Available share targets depend on your browser and installed apps.';
export const wordsAction = typeof navigator !== 'undefined' && typeof navigator.share === 'function' ? 'Share written words' : 'Copy written words';
function loadImage(source: ImageSourcePropType): Promise<HTMLImageElement> {
  const uri = typeof source === 'string' ? source : typeof source === 'number' ? Asset.fromModule(source).uri : !Array.isArray(source) ? source.uri : undefined;
  return new Promise((resolve, reject) => { const image = new window.Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Artwork unavailable')); image.src = uri ?? ''; });
}
function png(canvas: HTMLCanvasElement): Promise<Blob> { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Picture export unavailable')), 'image/png')); }
export async function prepareShare(copy: ShareCopy, ownerId: string): Promise<PreparedShare> {
  let files: File[];
  if (copy.kind === 'VOICE') {
    const bytes = await voiceStorage.read(ownerId, copy.voice);
    files = [new File([bytes.slice().buffer], `lantern-letter.${copy.voice.mimeType === 'audio/webm' ? 'webm' : 'm4a'}`, { type: copy.voice.mimeType })];
  } else {
    const [texture, border] = await Promise.all([loadImage(paperTextures[copy.preset.config.texture]), loadImage(paperBorders[copy.preset.config.motif])]);
    const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1500;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Picture export unavailable');
    const c = copy.preset.config; const font = `${c.font === 'script' ? 'italic ' : ''}34px ${c.font === 'classic' ? 'Palatino Linotype' : 'Georgia'}, serif`;
    ctx.font = font;
    const lines = wrapLetter(copy.text, line => ctx.measureText(line).width, 830);
    const count = Math.ceil(lines.length / 24); if (count > 8) throw new Error('Use the written words for this unusually spaced letter.');
    files = [];
    for (let page = 0; page < count; page++) {
      ctx.globalAlpha = 1; ctx.fillStyle = c.paperColor; ctx.fillRect(0, 0, 1080, 1500); ctx.drawImage(texture, 0, 0, 1080, 1500);
      const tint = document.createElement('canvas'); tint.width = 1080; tint.height = 1500; const tintCtx = tint.getContext('2d')!;
      tintCtx.drawImage(border, 0, 0, 1080, 1500); tintCtx.globalCompositeOperation = 'source-in'; tintCtx.fillStyle = c.ribbonColor; tintCtx.fillRect(0, 0, 1080, 1500);
      ctx.globalAlpha = .82; ctx.drawImage(tint, 0, 0); ctx.globalAlpha = 1;
      ctx.fillStyle = c.inkColor; ctx.textAlign = 'center'; ctx.font = '18px Georgia, serif'; ctx.fillText('FROM THE PALACE SCRIPTORIUM', 540, 138);
      ctx.strokeStyle = c.ribbonColor; ctx.beginPath(); ctx.moveTo(433, 165); ctx.lineTo(647, 165); ctx.stroke();
      ctx.textAlign = 'left'; ctx.font = font; ctx.textBaseline = 'top'; lines.slice(page * 24, page * 24 + 24).forEach((line, index) => ctx.fillText(line, 125, 224 + index * 44));
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.font = '20px Georgia, serif'; ctx.fillText(`Lantern Post · ${page + 1}${count > 1 ? ` / ${count}` : ''}`, 540, 1400);
      files.push(new File([await png(canvas)], `lantern-letter${count > 1 ? `-${page + 1}` : ''}.png`, { type: 'image/png' }));
    }
  }
  const previewUri = copy.kind === 'TEXT' && files[0] ? URL.createObjectURL(files[0]) : undefined;
  return { files, previewUri, dispose: () => { if (previewUri) URL.revokeObjectURL(previewUri); } };
}
export function canShareFiles(prepared: PreparedShare) { try { return typeof navigator.share === 'function' && navigator.canShare?.({ files: prepared.files }) === true; } catch { return false; } }
export const supportsDownload = true;
export async function eraseShareOwner(_ownerId:string) {}
export async function shareFiles(prepared: PreparedShare, _index=0): Promise<ShareResult> {
  try { await navigator.share({ title: 'A letter from Lantern Post', files: prepared.files }); return 'shared'; }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; throw error; }
}
export function downloadShare(prepared: PreparedShare) {
  for (const file of prepared.files) { const uri = URL.createObjectURL(file); const link = document.createElement('a'); link.href = uri; link.download = file.name; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(uri), 1000); }
}
export async function shareWords(text: string): Promise<ShareResult> {
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title: 'A letter from Lantern Post', text }); return 'shared'; }
    catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'; throw error; }
  }
  if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text); return 'shared';
}
