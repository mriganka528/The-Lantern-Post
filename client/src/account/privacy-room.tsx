import { useRef,useState } from 'react';
import { Text,TextInput,View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { GetSessionToken } from '../api/client';
import { apiRequest } from '../api/client';
import { draftStorage } from '../letters/draft-storage';
import { closeLocalAccount } from './account-local';
import type { AccountStatus } from './account-session';
import { StoryButton,StoryDialog,s } from '../storybook/story-ui';
import { DiagnosticsSettings } from '../diagnostics/diagnostics-settings';
import { PolicyLinks } from '../legal/policy-links';
export function PrivacyRoom({ownerId,username,getToken}:{ownerId:string;username:string;getToken:GetSessionToken}) {
  const [confirm,setConfirm]=useState(false);const [typed,setTyped]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');const locked=useRef(false);
  async function remove() {
    if(locked.current||typed!==username)return;locked.current=true;setBusy(true);setNotice('');
    try {const key='lantern-deletion-intent-v1-'+encodeURIComponent(ownerId);const id=draftStorage.read(key)??randomUUID();draftStorage.write(key,id);
      const status=await apiRequest<AccountStatus>('/account/status',getToken);const result=status.deletion?status:await apiRequest<AccountStatus>('/account/delete',getToken,{method:'POST',body:{requestId:id,confirmation:typed,confirmed:true}});
      if(result.deletion?.ownerId!==ownerId)throw Error();closeLocalAccount(ownerId);setNotice('Removal accepted. Closing your palace…');
    }catch{setNotice('Removal could not be confirmed, or local cleanup could not start. Retry to check the saved request before another attempt.');}finally{locked.current=false;setBusy(false);}
  }
  return <View style={{gap:24,borderWidth:1,borderColor:'#B99A61',padding:24,borderRadius:24,backgroundColor:'#F7EFDF'}}><Text style={s.dialogTitle}>Your privacy, in your hands</Text><DiagnosticsSettings /><PolicyLinks /><Text style={s.body}>Account removal closes your profile and clears your letters and chat conversations, including the other side of those conversations. App-managed Drive backups are removed while Drive remains connected. Limited content-free receipts and safety records are retained.</Text><Text style={s.body}>This device’s saved letters, recordings and backups are cleared too. Copies exported elsewhere and files on offline devices cannot be recalled. Other devices may retain local files until you clear them there.</Text><StoryButton label="Remove my account" secondary onPress={()=>{setTyped('');setNotice('');setConfirm(true);}} />
    {confirm&&<StoryDialog title="Close your palace permanently?" onClose={()=>{if(!busy)setConfirm(false);}}><Text style={s.body}>This cannot be undone. Save any copies you want before continuing. Type your username, {username}, to confirm.</Text><TextInput accessibilityLabel="Confirm username for account removal" value={typed} onChangeText={setTyped} autoCapitalize="none" autoCorrect={false} editable={!busy} style={[s.body,{padding:14,borderWidth:1,borderColor:'#B99A61'}]} /><StoryButton label="Permanently remove my account" disabled={typed!==username||busy} busy={busy} onPress={()=>{void remove();}} /><StoryButton label="Keep my palace" secondary disabled={busy} onPress={()=>setConfirm(false)} />{Boolean(notice)&&<Text accessibilityLiveRegion="polite" style={s.body}>{notice}</Text>}</StoryDialog>}
  </View>;
}
