// This portable adapter keeps Expo Go and web usable without a native push
// package. setup:push installs the reviewed native adapter after its SDK
// dependencies are available; this file remains the web fallback.
import type { NotificationDestination } from './notification-contract';
export interface PushDriver {
  available(): boolean;
  token(requestPermission: boolean): Promise<string>;
  listen(ownerId: string, onOpen: (destination:NotificationDestination) => void): Promise<() => void>;
}
export const pushDriver: PushDriver = {
  available: () => false,
  token: async () => { throw new Error('Device notifications are unavailable in this version.'); },
  listen: async () => () => {},
};
