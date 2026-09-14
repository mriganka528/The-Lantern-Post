import type { ReactNode } from 'react';
import { Text } from 'react-native';
import type { GetSessionToken } from '../api/client';
import { StoryButton, StoryDialog, s } from '../storybook/story-ui';
import { UsernameCard } from '../friends/username-card';
import { NotificationSettings } from '../notifications/notification-settings';
import { DiagnosticsSettings } from '../diagnostics/diagnostics-settings';
import { PolicyLinks } from '../legal/policy-links';

export function AccountMenu({ ownerId, username, getToken, onClose, onPrivacy, signOut }: {
  ownerId: string; username: string; getToken: GetSessionToken;
  onClose: () => void; onPrivacy: () => void; signOut?: ReactNode;
}) {
  return <StoryDialog title="Your little corner" onClose={onClose}>
    <Text style={s.body}>Signed in as {username}</Text>
    <UsernameCard username={username} />
    <StoryButton label="Chat backups & privacy" onPress={onPrivacy} />
    <NotificationSettings ownerId={ownerId} getToken={getToken} />
    <DiagnosticsSettings />
    <PolicyLinks />
    {signOut}
  </StoryDialog>;
}
