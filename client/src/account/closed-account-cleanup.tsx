import { useEffect,useState } from 'react';
import { AppState,Text,View } from 'react-native';
import { erasePreviouslyClosedAccounts } from './account-local';
import { StoryButton,s } from '../storybook/story-ui';
// Finish durable cleanup even when Clerk has already removed the identity and
// the next app launch is signed out (or belongs to a different account).
export function ClosedAccountCleanup() {
  const [failed,setFailed]=useState(false);const [retry,setRetry]=useState(0);
  useEffect(()=>{let active=true;let busy=false;const run=async()=>{if(busy)return;busy=true;try{await erasePreviouslyClosedAccounts();if(active)setFailed(false);}catch{if(active)setFailed(true);}finally{busy=false;}};void run();const sub=AppState.addEventListener('change',state=>{if(state==='active')void run();});return()=>{active=false;sub.remove();};},[retry]);
  return failed?<View style={{padding:16,gap:10,backgroundColor:'#F3E8CF'}}><Text style={s.body}>Some files from a removed account still need to be cleared on this device.</Text><StoryButton label="Retry removed-account cleanup" secondary onPress={()=>setRetry(n=>n+1)} /></View>:null;
}
