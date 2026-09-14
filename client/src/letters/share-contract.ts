import type { LetterPreset, VoiceClip } from '@lantern-post/shared-types';
import type { LetterDraft } from './draft';
import { cleanPreset, letterProblem } from './draft';

export type ShareCopy = { kind: 'TEXT'; text: string; preset: LetterPreset } | { kind: 'VOICE'; voice: VoiceClip; caption: string; preset: LetterPreset };
// Own, editable/sealed content only. A pending or completed release cannot be
// exported from the receipt fence. No author, friend or operation ID is included.
export function shareCopy(draft: LetterDraft, ownerId: string): ShareCopy | null {
  const preset = cleanPreset(draft.preset);
  if (draft.ownerId !== ownerId || !preset || !['writing', 'sealed'].includes(draft.stage) || draft.voiceDeletes.length) return null;
  if (draft.kind === 'TEXT') return letterProblem(draft.text) ? null : { kind: 'TEXT', text: draft.text, preset };
  return draft.voice ? { kind: 'VOICE', voice: { ...draft.voice }, caption: draft.voiceCaption, preset } : null;
}
export type ShareResult = 'shared' | 'cancelled';
export interface PreparedShare { previewUri?: string; files: File[]; nativeFiles?: { uri:string; mimeType:string }[]; ownerId?:string; dispose(): void; }
export function wrapLetter(text: string, measure: (text: string) => number, width: number): string[] {
  const lines: string[] = [];
  // Preserve words and paragraph breaks. Runs of blank space need not create
  // dozens of empty picture pages; the plain text export stays exact.
  for (const paragraph of text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').split('\n')) {
    if (!paragraph) { lines.push(''); continue; }
    let line = '';
    for (const piece of paragraph.split(/(\s+)/u)) {
      if (measure(line + piece) <= width) { line += piece; continue; }
      if (line) { lines.push(line.trimEnd()); line = ''; }
      for (const character of Array.from(piece.trimStart())) {
        if (line && measure(line + character) > width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line.trimEnd());
  }
  return lines;
}
