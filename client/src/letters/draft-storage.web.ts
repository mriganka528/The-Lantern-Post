import type { DraftStorage } from './draft';

export const draftStorage: DraftStorage = {
  read: key => window.localStorage.getItem(key),
  write: (key, value) => { window.localStorage.setItem(key, value); },
  subscribe(key, listener) {
    const onChange = (event: StorageEvent) => { if (event.storageArea === window.localStorage && (event.key === key || event.key === null)) listener(); };
    window.addEventListener('storage', onChange);
    return () => window.removeEventListener('storage', onChange);
  },
};
