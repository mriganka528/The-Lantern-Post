import type { LetterLibraryStorage } from './letter-library';
import { assertPrivateWrite } from '../account/local-privacy';

export const draftStorage: LetterLibraryStorage = {
  keys: () => Object.keys(window.localStorage),
  read: key => { assertPrivateWrite(key,k => window.localStorage.getItem(k)); return window.localStorage.getItem(key); },
  remove: key => { window.localStorage.removeItem(key); queueMicrotask(() => window.dispatchEvent(new CustomEvent('lantern-letter-stored', { detail: key }))); },
  write: (key, value) => { assertPrivateWrite(key,k => window.localStorage.getItem(k)); window.localStorage.setItem(key, value); queueMicrotask(() => window.dispatchEvent(new CustomEvent('lantern-letter-stored', { detail: key }))); },
  subscribe(key, listener) {
    const onChange = (event: StorageEvent) => { if (event.storageArea === window.localStorage && (event.key === key || event.key === null)) listener(); };
    const onLocal = (event: Event) => { if ((event as CustomEvent<string>).detail === key) listener(); };
    window.addEventListener('storage', onChange);
    window.addEventListener('lantern-letter-stored', onLocal);
    return () => { window.removeEventListener('storage', onChange); window.removeEventListener('lantern-letter-stored', onLocal); };
  },
  watch(listener) {
    const local = (event: Event) => listener((event as CustomEvent<string>).detail);
    const other = (event: StorageEvent) => { if (event.storageArea === window.localStorage) listener(event.key); };
    window.addEventListener('lantern-letter-stored', local); window.addEventListener('storage', other);
    return () => { window.removeEventListener('lantern-letter-stored', local); window.removeEventListener('storage', other); };
  },
};
