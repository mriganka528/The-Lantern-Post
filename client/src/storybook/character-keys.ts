import type { CharacterKey } from '@lantern-post/shared-types';
// The shared package is type-only; runtime catalog validation stays in the app.
const supported = { 'fox-lantern': true, 'rabbit-moon': true, 'owl-scholar': true, 'deer-dawn': true, 'cat-astral': true, 'swan-cloud': true, 'unicorn-aurelia': true, 'peacock-seraph': true, 'lion-solstice': true, 'dragon-jade': true } satisfies Record<CharacterKey, true>;
export const CHARACTER_KEYS = Object.keys(supported) as CharacterKey[];
