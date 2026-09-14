import { Share } from 'react-native';
import { usernameCard } from './username-card-contract';
export const canCopyUsername = false;
export async function copyUsername(_username: string) { throw new Error('Use the device text selection menu.'); }
export async function shareUsername(username: string): Promise<'shared' | 'cancelled' | 'copied'> {
  const card = usernameCard(username); const result = await Share.share({ title: card.title, message: card.text });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
