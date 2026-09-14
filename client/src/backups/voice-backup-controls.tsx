import { useEffect,useRef,useState } from 'react';
import { Pressable,Text,View } from 'react-native';
import { StoryButton,StoryDialog,s } from '../storybook/story-ui';
import { voiceBackupChoices } from './voice-backup';
import type { VoiceArchive } from './voice-backup-contract';
import { VoicePlayer } from '../voice/voice-player';
import { PaperFrame } from '../letters/stationery';
import type { PreparedShare } from '../letters/share-contract';
import { prepareVoiceArchiveMedia } from './voice-backup-media';
import { downloadShare,shareFiles,supportsDownload } from '../letters/share-platform';
import { assertAccountOpen } from '../account/account-fence';
export function VoiceBackupPicker({ownerId,busy,driveConnected,onBackup}:{ownerId:string;busy:boolean;driveConnected:boolean;onBackup:(key:string,caption:boolean,target:'local'|'drive')=>void}) {
  const [choices,setChoices]=useState<ReturnType<typeof voiceBackupChoices>>([]);const [selected,setSelected]=useState('');const [caption,setCaption]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{let active=true;queueMicrotask(()=>{if(!active)return;try{setChoices(voiceBackupChoices(ownerId));}catch{setError('Your local recordings could not be read.');}});return()=>{active=false;};},[ownerId]);
  return <View style={{padding:24,gap:16,borderWidth:1,borderColor:'#B99A61',borderRadius:24,backgroundColor:'#EEE7F1'}}><Text style={s.dialogTitle}>Your voice, kept close</Text><Text style={s.body}>Recordings stay on this device while you write. Keep one recording in each encrypted backup before sending or burning its letter. A Google Drive copy can be opened after reinstalling with the same account and its recovery key.</Text>
    {choices.map((choice,index)=><StoryButton key={choice.key} secondary label={`Choose recording ${index+1} · ${new Date(choice.updatedAt).toLocaleString()}${selected===choice.key?' · selected':''}`} disabled={busy} onPress={()=>{setSelected(choice.key);setCaption(false);}} />)}
    {choices.length===0&&<Text style={s.body}>Save a voice letter at your writing desk to add a keepsake here.</Text>}
    {choices.find(choice=>choice.key===selected)?.hasCaption&&<Pressable accessibilityRole="checkbox" accessibilityState={{checked:caption}} aria-checked={caption} accessibilityLabel="Include written caption in voice backup" disabled={busy} onPress={()=>setCaption(value=>!value)} style={{paddingVertical:12}}><Text style={s.body}>{caption?'☑':'☐'} Include the written caption in this backup</Text></Pressable>}
    <StoryButton label="Back up recording on this device" disabled={busy||!selected} onPress={()=>onBackup(selected,caption,'local')} /><StoryButton label="Back up recording to Google Drive" secondary disabled={busy||!selected||!driveConnected} onPress={()=>onBackup(selected,caption,'drive')} />
    <StoryButton label="Refresh local recordings" secondary disabled={busy} onPress={()=>{try{setChoices(voiceBackupChoices(ownerId));setSelected('');setCaption(false);setError('');}catch{setError('Your local recordings could not be read.');}}} />{Boolean(error)&&<Text style={s.body}>{error}</Text>}
  </View>;
}
export function VoiceBackupReader({ownerId,archive,onClose}:{ownerId:string;archive:VoiceArchive;onClose:()=>void}) {
  const [media,setMedia]=useState<PreparedShare|null>(null);const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  const mounted=useRef(true);const sharing=useRef(false);const deferredCleanup=useRef<(()=>void)|null>(null);
  useEffect(()=>{let active=true;mounted.current=true;let result:PreparedShare|null=null;void prepareVoiceArchiveMedia(ownerId,archive).then(value=>{if(!active)value.dispose();else{result=value;setMedia(value);}}).catch(()=>{if(active)setNotice('This recording could not be opened.');});return()=>{active=false;mounted.current=false;if(sharing.current)deferredCleanup.current=()=>result?.dispose();else result?.dispose();};},[ownerId,archive]);
  const content=<View style={{gap:16}}>{media?.previewUri?<VoicePlayer uri={media.previewUri} durationMs={archive.voice.durationMs} label="Your recovered recording" />:<Text style={s.body}>Opening your recording…</Text>}{Boolean(archive.caption)&&<Text selectable style={s.body}>{archive.caption}</Text>}</View>;
  return <StoryDialog title="Your voice, remembered." onClose={()=>{if(!busy)onClose();}}><Text style={s.body}>A private backup from {new Date(archive.createdAt).toLocaleString()}. Playing or saving this recording sends no letter.</Text>{archive.preset?<PaperFrame preset={archive.preset}>{content}</PaperFrame>:content}<StoryButton label={supportsDownload?'Save recovered recording':'Save or share recovered recording'} disabled={!media||busy} onPress={()=>{if(!media||sharing.current)return;sharing.current=true;setBusy(true);setNotice('');void(async()=>{try{assertAccountOpen(ownerId);if(supportsDownload)downloadShare(media);else await shareFiles(media);if(mounted.current)setNotice('Your recording copy is ready.');}catch{if(mounted.current)setNotice('The recording could not be saved. Try again.');}finally{sharing.current=false;deferredCleanup.current?.();deferredCleanup.current=null;if(mounted.current)setBusy(false);}})();}} />{Boolean(notice)&&<Text style={s.body}>{notice}</Text>}</StoryDialog>;
}
