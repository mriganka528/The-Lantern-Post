import type { SavedPush } from './notification-contract';
export const readPush = async (_ownerId: string): Promise<SavedPush | null> => null;
export const writePush = async (_record: SavedPush): Promise<void> => {};
export const removePush = async (_ownerId: string): Promise<void> => {};
export const notifyPushChange = () => {};
export const subscribePushChange = (_listener: () => void) => () => {};
