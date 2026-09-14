import { useAuth,useClerk } from '@clerk/expo';
import { useEffect,useState } from 'react';
import type { PropsWithChildren } from 'react';
import { AppState,Text,View } from 'react-native';
import { apiRequest } from '../api/client';
import { useSessionToken } from '../auth/use-session-token';
import { draftStorage } from '../letters/draft-storage';
import { closedAccountKey } from './local-privacy';
import { eraseLocalAccount } from './account-local';
import { StoryShell,StoryHeading,StoryButton,s } from '../storybook/story-ui';
import { pauseVoicePlayback } from '../voice/playback-registry';
export interface AccountStatus { ownerId?:string|null; deletion:null|{id:string;ownerId:string;state:'PENDING'|'COMPLETE'}; }
export function AccountSession({children}:PropsWithChildren) {
  const {isSignedIn}=useAuth();const {signOut}=useClerk();const token=useSessionToken();const [owner,setOwner]=useState<string|null>(null);const [closed,setClosed]=useState<string|null>(null);const [clean,setClean]=useState(false);const [error,setError]=useState(false);const [attempt,setAttempt]=useState(0);
  useEffect(()=>{if(!isSignedIn)return;let active=true;let running=false;let abort:AbortController|undefined;const check=async()=>{if(running||AppState.currentState!=='active')return;running=true;abort=new AbortController();try{const status=await apiRequest<AccountStatus>('/account/status',token,{signal:abort.signal});if(active){const id=status.deletion?.ownerId??status.ownerId??null;setOwner(id);if(status.deletion)setClosed(status.deletion.ownerId);else if(id&&draftStorage.read(closedAccountKey(id)))setClosed(id);}}catch{/* Existing local pages remain usable during a connection outage. */}finally{running=false;}};void check();const timer=setInterval(()=>void check(),15000);const sub=AppState.addEventListener('change',state=>{if(state==='active')void check();else abort?.abort();});return()=>{active=false;abort?.abort();clearInterval(timer);sub.remove();};},[isSignedIn,token]);
  useEffect(()=>{if(!owner)return;return draftStorage.watch?.(key=>{if(key===closedAccountKey(owner)||key===null){try{if(draftStorage.read(closedAccountKey(owner)))setClosed(owner);}catch{setClosed(owner);}}});},[owner]);
  useEffect(()=>{if(!closed)return;let active=true;pauseVoicePlayback();void eraseLocalAccount(closed).then(()=>{if(active)setClean(true);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[closed,attempt]);
  if(!closed)return children;
  return <StoryShell><StoryHeading eyebrow="YOUR PRIVACY" title="Your palace is closing." subtitle="Your account removal was accepted. Server cleanup continues in the background." /><View style={{gap:20,maxWidth:640,alignSelf:'center'}}><Text style={s.body}>Your profile, letters and conversations are no longer available in the app. Delivery receipts and limited safety records remain without letter or message text. Copies already exported to other devices or people cannot be recalled.</Text><Text style={s.body}>{clean?'Local letters, recordings and app backups have been cleared on this device.':error?'Some local files could not be cleared. Keep this page open and retry.':'Clearing this device’s private files…'}</Text>{error&&<StoryButton label="Retry local cleanup" onPress={()=>setAttempt(n=>n+1)} />}<StoryButton label="Sign out" disabled={!clean} onPress={()=>{void signOut();}} /></View></StoryShell>;
}
