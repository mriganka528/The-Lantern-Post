import type { WorldLetter } from '@lantern-post/shared-types';
// Curated storybook samples only. Never submitted, mixed into live queries,
// attributed to real users or stored as a visitor's draft.
const notes = [
  'Dear traveller,\n\nMay a little kindness find you, even on the days when you forget to look for it.\n\nWith a little light.',
  'I planted a wish beside the moonflowers. I do not know when it will bloom, but I am glad I planted it.',
  'Some journeys are made of very small steps. Today, one step was enough.',
  'A cup of tea. An open window. Someone remembering your name. There is magic in small things, too.',
  'To whoever needs a gentler evening: may the sky hold a little of what you have carried today.',
  'Once upon a time, a quiet heart found its way home. The story is still being written.',
];
export const sampleStars: WorldLetter[] = notes.map((textContent, i) => ({ id: `sample-${i + 1}`, type: 'TEXT', x: [480, 684, 900, 1090, 530, 1030][i]!, y: [270, 370, 285, 440, 570, 660][i]!, textContent, audio: null, signature: null, mine: false, deliveredAt: '2026-01-01T00:00:00Z',
  preset: { id: 'sample-stationery', key: 'royal', displayName: 'Moonlit vellum', description: 'Storybook preview stationery', config: { paperColor: '#EFE1BE', inkColor: '#534335', sealColor: '#947270', ribbonColor: '#A5A894', texture: 'vellum', motif: 'stars', font: 'book' } },
}));
