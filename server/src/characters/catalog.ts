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
  'unicorn-aurelia': { collection: 'royal', title: 'The keeper of opal wishes', description: 'An ivory unicorn in a pearl-embroidered mantle, carrying a gilded star wand and the wishes you dare to keep.', palace: { theme: 'opal-citadel', name: 'The Opal Citadel', description: 'Opalescent arches, pearl garlands and moonlit gardens around a palace of gentle wishes.' } },
  'peacock-seraph': { collection: 'royal', title: 'The herald of sapphire skies', description: 'A regal peacock with a jeweled fan, a velvet court coat and a little sealed treasure for every journey.', palace: { theme: 'sapphire-pavilion', name: 'The Sapphire Pavilion', description: 'Sapphire glass, feathered rosettes and gilded colonnades mirrored in quiet green water.' } },
  'lion-solstice': { collection: 'royal', title: 'The guardian of golden mornings', description: 'A kind lion with a sunlit mane, an antique crown and a warm velvet cloak stitched with tiny constellations.', palace: { theme: 'suncrest-court', name: 'The Suncrest Palace', description: 'Crowned towers, sunburst windows and a golden courtyard where every morning feels like a beginning.' } },
  'dragon-jade': { collection: 'royal', title: 'The dreamer of emerald clouds', description: 'A gentle jade dragon with moon-shaped horns, silk wings and a lantern full of emerald dreams.', palace: { theme: 'jade-sanctuary', name: 'The Jade Sanctuary', description: 'Emerald roofs, hanging lanterns and sweeping gold tracery above a river of cloud reflections.' } },
} as const satisfies Record<CharacterKey, CharacterStory>;

export const characterKeys = Object.keys(characterStories) as CharacterKey[];

export function isCharacterKey(key: string): key is CharacterKey {
  return Object.hasOwn(characterStories, key);
}

export function serializeCharacter(row: { id: string; key: string; displayName: string; assetUrl: string }): CharacterDetails | null {
  if (!isCharacterKey(row.key)) return null;
  return { id: row.id, key: row.key, displayName: row.displayName, assetUrl: row.assetUrl, ...characterStories[row.key] };
}
