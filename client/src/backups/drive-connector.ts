import type { GetSessionToken } from '../api/client';
import { prepareDriveWindow } from './backup-files';

export type DriveConnector =
  | { kind: 'browser'; window: { open(url: string): void | Promise<void>; close(): void } }
  | { kind: 'native'; connect(getToken: GetSessionToken, signal: AbortSignal): Promise<boolean> };

export function prepareDriveConnector(): DriveConnector { return { kind: 'browser', window: prepareDriveWindow() }; }
