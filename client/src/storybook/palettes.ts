import type { CharacterKey } from '@lantern-post/shared-types';

export interface StoryPalette {
  sky: string; mist: string; wall: string; shade: string; roof: string;
  accent: string; foliage: string; fur: string; furLight: string; coat: string;
}

export const palettes: Record<CharacterKey, StoryPalette> = {
  'fox-lantern': { sky: '#E7D7B6', mist: '#FBF4DF', wall: '#F0DFBB', shade: '#D4BD90', roof: '#819083', accent: '#9C6336', foliage: '#858D6B', fur: '#C88951', furLight: '#FBEDD5', coat: '#687E71' },
  'rabbit-moon': { sky: '#DADDE7', mist: '#FAF6EB', wall: '#EDE5D7', shade: '#C8C4D2', roof: '#9A9AAE', accent: '#746589', foliage: '#8F9E94', fur: '#E7DFD3', furLight: '#FFFAEE', coat: '#A397B4' },
  'owl-scholar': { sky: '#C9D8E1', mist: '#F6F3E6', wall: '#E4DCC7', shade: '#BFB9A1', roof: '#647D90', accent: '#506B80', foliage: '#7F9591', fur: '#AC9370', furLight: '#F9EBD1', coat: '#627C8C' },
  'deer-dawn': { sky: '#ECD6CD', mist: '#FFF3DF', wall: '#F0DACA', shade: '#CCAD9E', roof: '#9E8F85', accent: '#936A69', foliage: '#869275', fur: '#BD9775', furLight: '#F8E9D2', coat: '#AF8484' },
  'cat-astral': { sky: '#DAD3E4', mist: '#F9F0EA', wall: '#E9DDD6', shade: '#C0AEC3', roof: '#867B9A', accent: '#746083', foliage: '#8C91A0', fur: '#7F8292', furLight: '#DDD9E3', coat: '#8C7499' },
  'swan-cloud': { sky: '#D7E4DF', mist: '#FFFFF0', wall: '#F5EEDD', shade: '#CCCEB9', roof: '#8FA9A0', accent: '#69877D', foliage: '#94AB93', fur: '#F7F2E5', furLight: '#FFFDF3', coat: '#9DB6A8' },
};
