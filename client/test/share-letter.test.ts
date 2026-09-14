import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newDraft } from '../src/letters/draft';
import { shareCopy, wrapLetter } from '../src/letters/share-contract';
import type { LetterPreset } from '@lantern-post/shared-types';
const preset: LetterPreset = { id: 'page', key: 'royal', displayName: 'Royal', description: 'Paper', config: { paperColor: '#F8EED6', inkColor: '#443C2F', sealColor: '#946347', ribbonColor: '#849079', texture: 'parchment', motif: 'royal', font: 'book' } };
test('sharing an owned draft creates a content-only copy without changing its saved state or signing it', () => {
  const draft = { ...newDraft('private-owner'), text: 'A note <script>stays written</script> 💛', preset }; const before = JSON.stringify(draft);
  const copy = shareCopy(draft, 'private-owner')!; assert.equal(copy.kind, 'TEXT'); assert.equal(JSON.stringify(draft), before);
  for (const key of ['ownerId', 'generationId', 'requestId', 'recipient', 'worldSigned']) assert.ok(!JSON.stringify(copy).includes(key));
  assert.equal(shareCopy(draft, 'someone-else'), null);
});
test('pending operations, cleared journeys, empty pages and cleanup fences cannot be exported', () => {
  const draft = { ...newDraft('a'), text: 'Words', preset };
  for (const stage of ['burn-pending', 'delivery-pending', 'world-pending', 'burned', 'delivered', 'published'] as const) assert.equal(shareCopy({ ...draft, stage }, 'a'), null);
  assert.equal(shareCopy({ ...draft, text: '' }, 'a'), null); assert.equal(shareCopy({ ...draft, voiceDeletes: ['queued'] }, 'a'), null);
});
test('illustrated line wrapping retains Unicode, newlines, words and overlong runs without clipping', () => {
  const measure = (text: string) => Array.from(text).length;
  assert.deepEqual(wrapLetter('A little\nletter 💛\n\nABCDEF', measure, 6), ['A', 'little', 'letter', '💛', '', 'ABCDEF']);
  const text = '💛'.repeat(50); const lines = wrapLetter(text, measure, 7); assert.equal(lines.join(''), text); assert.ok(lines.every(line => measure(line) <= 7));
});
