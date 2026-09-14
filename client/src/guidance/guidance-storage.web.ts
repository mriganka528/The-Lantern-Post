import { GUIDANCE_KEY } from './guidance-model';
import type { GuidanceStorage } from './guidance-model';

export const guidanceStorage: GuidanceStorage = {
  read: () => window.localStorage.getItem(GUIDANCE_KEY),
  write: value => window.localStorage.setItem(GUIDANCE_KEY, value),
};
