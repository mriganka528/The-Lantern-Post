import { draftStorage } from '../letters/draft-storage';
import { closedAccountKey } from './local-privacy';
export function assertAccountOpen(ownerId: string) { if (draftStorage.read(closedAccountKey(ownerId)) !== null) throw new Error('This account is closed.'); }
