import * as SecureStore from 'expo-secure-store';
import { parseSavedPush } from './notification-contract';
import type { SavedPush } from './notification-contract';
const key = (ownerId: string) => {
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(ownerId)) throw new Error('Invalid notification owner.');
  return `lantern-push-v1-${ownerId}`;
};
export const readPush = async (ownerId: string) => parseSavedPush(await SecureStore.getItemAsync(key(ownerId)), ownerId);
export const writePush = (record: SavedPush) => SecureStore.setItemAsync(key(record.ownerId), JSON.stringify(record));
export const removePush = (ownerId: string) => SecureStore.deleteItemAsync(key(ownerId));
const listeners = new Set<() => void>();
export const notifyPushChange = () => listeners.forEach(listener => listener());
export const subscribePushChange = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
