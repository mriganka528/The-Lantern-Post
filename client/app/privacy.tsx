import { Redirect,useRouter } from 'expo-router';
import { StoryShell,TextAction } from '../src/storybook/story-ui';
import { useSelfProfile } from '../src/api/use-self-profile';
import { useSessionToken } from '../src/auth/use-session-token';
import { LoadingScreen } from '../src/components/auth-ui';
import { ProfileErrorScreen } from '../src/components/profile-status';
import { BackupRoom } from '../src/backups/backup-room';
import { PrivacyRoom } from '../src/account/privacy-room';
export default function PrivacyScreen() {
  const profile=useSelfProfile();const token=useSessionToken();const router=useRouter();
  if(profile.isPending)return <LoadingScreen />;if(profile.isError)return <ProfileErrorScreen error={profile.error} onRetry={()=>{void profile.refetch();}} />;if(!profile.data.user)return <Redirect href="/choose-username" />;
  const user=profile.data.user;
  return <StoryShell chapter="THE ROYAL ARCHIVE & PRIVACY" actions={<TextAction label="My palace" onPress={()=>router.replace('/')} />}><BackupRoom ownerId={user.id} getToken={token} /><PrivacyRoom ownerId={user.id} username={user.username} getToken={token} /></StoryShell>;
}
