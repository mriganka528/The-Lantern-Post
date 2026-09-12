import type { CharacterDetails, CharacterKey } from '@lantern-post/shared-types';

type CharacterStory = Omit<CharacterDetails, 'id' | 'key' | 'displayName' | 'assetUrl'>;

// Editorial metadata stays server-owned; clients cannot choose arbitrary themes.
export const characterStories = {
  'fox-lantern': {
    title: 'The keeper of little lights',
    description: 'A warm-hearted wanderer who finds a little light in every story. No thought is too small to carry.',
    palace: { theme: 'amber-hollow', name: 'The Amber Palace', description: 'Honey-coloured windows, a crackling hearth, and a place for every little hope.' },
  },
  'rabbit-moon': {
    title: 'The dreamer in the garden',
    description: 'A gentle soul who gathers moonflowers and listens to the things you haven’t found words for yet.',
    palace: { theme: 'moonlit-conservatory', name: 'The Moonflower Palace', description: 'A silver conservatory where moonflowers bloom and quiet thoughts take root.' },
  },
  'owl-scholar': {
    title: 'The collector of stories',
    description: 'A thoughtful friend with a pocket full of constellations. Every letter has a place in their heart.',
    palace: { theme: 'starlight-library', name: 'The Starlight Library', description: 'Tall, blue windows and shelves of unwritten stories beneath a ceiling of stars.' },
  },
  'deer-dawn': {
    title: 'The guardian of new beginnings',
    description: 'A tender spirit who walks softly through the morning. A reminder that you can always begin again.',
    palace: { theme: 'rosewood-sanctuary', name: 'The Rosewood Palace', description: 'Blush-coloured arches, climbing roses, and the first golden light of morning.' },
  },
  'cat-astral': {
    title: 'The wanderer between stars',
    description: 'A curious companion who follows falling stars and believes a little mystery is good for the soul.',
    palace: { theme: 'celestial-observatory', name: 'The Astral Palace', description: 'A violet observatory for watching the sky and dreaming a little beyond it.' },
  },
  'swan-cloud': {
    title: 'The messenger of the clouds',
    description: 'A graceful friend who carries your words as softly as a feather on the evening breeze.',
    palace: { theme: 'cloud-court', name: 'The Cloud Palace', description: 'Pearl-white towers floating above a sea of clouds, where the world feels wonderfully still.' },
  },
} as const satisfies Record<CharacterKey, CharacterStory>;

export const characterKeys = Object.keys(characterStories) as CharacterKey[];

export function isCharacterKey(key: string): key is CharacterKey {
  return Object.hasOwn(characterStories, key);
}

export function serializeCharacter(row: { id: string; key: string; displayName: string; assetUrl: string }): CharacterDetails | null {
  if (!isCharacterKey(row.key)) return null;
  return { id: row.id, key: row.key, displayName: row.displayName, assetUrl: row.assetUrl, ...characterStories[row.key] };
}
