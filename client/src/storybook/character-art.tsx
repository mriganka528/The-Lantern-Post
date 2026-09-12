import { Image } from 'react-native';
import type { CharacterKey } from '@lantern-post/shared-types';
import { characterArtwork } from './artwork';

export function CharacterArt({ characterKey, size = 220 }: { characterKey: CharacterKey; size?: number }) {
  return <Image source={characterArtwork[characterKey]} style={{ width: size, height: size * 1.12 }} resizeMode="contain" accessible={false} />;
}
