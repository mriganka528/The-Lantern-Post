import { useEffect,useState } from 'react';
import { Pressable,Text,View } from 'react-native';
import { draftStorage } from '../letters/draft-storage';
import { s } from '../storybook/story-ui';
export const alertKey=(ownerId:string)=>'lantern-alerts-v1-'+encodeURIComponent(ownerId);
export const inAppAlertsEnabled=(ownerId:string)=>draftStorage.read(alertKey(ownerId))!=='off';
export function PalaceAlertSettings({ownerId}:{ownerId:string}) {
  const [enabled,setEnabled]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{let active=true;const update=()=>{try{const value=inAppAlertsEnabled(ownerId);if(active)setEnabled(value);}catch{if(active)setError('Your alert preference could not be read.');}};queueMicrotask(update);const stop=draftStorage.subscribe?.(alertKey(ownerId),update);return()=>{active=false;stop?.();};},[ownerId]);
  return <View style={{gap:10}}><Pressable accessibilityRole="switch" accessibilityLabel="In-app arrival alerts" accessibilityState={{checked:enabled}} aria-checked={enabled} onPress={()=>{try{draftStorage.write(alertKey(ownerId),enabled?'off':'on');setEnabled(!enabled);setError('');}catch{setError('Your alert preference could not be saved.');}}} style={{minHeight:48,padding:12,borderWidth:1,borderColor:'#BCA370',backgroundColor:enabled?'#E5E9DA':'#F3EBD8',borderRadius:12}}><Text style={s.body}>{enabled?'✦ Arrival alerts on':'Arrival alerts off'}</Text></Pressable><Text style={s.body}>A small palace notice for new messages, letters and invitations while the app is open.</Text>{Boolean(error)&&<Text style={s.body}>{error}</Text>}</View>;
}
