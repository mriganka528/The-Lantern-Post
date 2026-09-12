import { Platform } from 'react-native';

export const ink = '#403C32';
export const mutedInk = '#726B5D';
export const paper = '#F8F4EA';
export const gold = '#A38449';
export const line = '#D9CDB4';
export const serif = Platform.select({ android: 'serif', default: 'Georgia' });
export const italic = serif;
export const bodyFont = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui' });

export { palettes } from './palettes';
