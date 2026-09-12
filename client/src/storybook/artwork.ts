import type { CharacterKey } from '@lantern-post/shared-types';
import type { ImageSourcePropType } from 'react-native';

export const characterArtwork: Record<CharacterKey, ImageSourcePropType> = {
  'fox-lantern': require('../../assets/storybook/character-fox-lantern.png'),
  'rabbit-moon': require('../../assets/storybook/character-rabbit-moon.png'),
  'owl-scholar': require('../../assets/storybook/character-owl-scholar.png'),
  'deer-dawn': require('../../assets/storybook/character-deer-dawn.png'),
  'cat-astral': require('../../assets/storybook/character-cat-astral.png'),
  'swan-cloud': require('../../assets/storybook/character-swan-cloud.png'),
};

export const palaceArtwork: Record<CharacterKey, ImageSourcePropType> = {
  'fox-lantern': require('../../assets/storybook/palace-fox-lantern.png'),
  'rabbit-moon': require('../../assets/storybook/palace-rabbit-moon.png'),
  'owl-scholar': require('../../assets/storybook/palace-owl-scholar.png'),
  'deer-dawn': require('../../assets/storybook/palace-deer-dawn.png'),
  'cat-astral': require('../../assets/storybook/palace-cat-astral.png'),
  'swan-cloud': require('../../assets/storybook/palace-swan-cloud.png'),
};

export const walkingArtwork: Record<CharacterKey, { body: ImageSourcePropType; left: ImageSourcePropType; right: ImageSourcePropType }> = {
  'fox-lantern': { body: require('../../assets/storybook/walk-fox-lantern-body.png'), left: require('../../assets/storybook/walk-fox-lantern-left-foot.png'), right: require('../../assets/storybook/walk-fox-lantern-right-foot.png') },
  'rabbit-moon': { body: require('../../assets/storybook/walk-rabbit-moon-body.png'), left: require('../../assets/storybook/walk-rabbit-moon-left-foot.png'), right: require('../../assets/storybook/walk-rabbit-moon-right-foot.png') },
  'owl-scholar': { body: require('../../assets/storybook/walk-owl-scholar-body.png'), left: require('../../assets/storybook/walk-owl-scholar-left-foot.png'), right: require('../../assets/storybook/walk-owl-scholar-right-foot.png') },
  'deer-dawn': { body: require('../../assets/storybook/walk-deer-dawn-body.png'), left: require('../../assets/storybook/walk-deer-dawn-left-foot.png'), right: require('../../assets/storybook/walk-deer-dawn-right-foot.png') },
  'cat-astral': { body: require('../../assets/storybook/walk-cat-astral-body.png'), left: require('../../assets/storybook/walk-cat-astral-left-foot.png'), right: require('../../assets/storybook/walk-cat-astral-right-foot.png') },
  'swan-cloud': { body: require('../../assets/storybook/walk-swan-cloud-body.png'), left: require('../../assets/storybook/walk-swan-cloud-left-foot.png'), right: require('../../assets/storybook/walk-swan-cloud-right-foot.png') },
};
