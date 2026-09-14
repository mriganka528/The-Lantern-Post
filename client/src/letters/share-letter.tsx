import { useEffect, useRef, useState } from 'react';
import { Image, Platform, Text, View } from 'react-native';
import type { LetterDraft } from './draft';
import { shareCopy } from './share-contract';
import type { PreparedShare, ShareCopy } from './share-contract';
import { canShareFiles, downloadShare, fileSharingAvailable, fileSharingNote, prepareShare, shareFiles, shareWords, supportsDownload, wordsAction } from './share-platform';
import { ShareRenderer } from './share-renderer';
import { StoryButton, StoryDialog, s } from '../storybook/story-ui';
import { LocalVoicePlayer } from '../voice/voice-composer';
import { PaperFrame, stationeryFont } from './stationery';
import { RoyalNavButton } from '../storybook/royal-navigation';

export function ShareLetter({ draft, ownerId, disabled }: { draft: LetterDraft; ownerId: string; disabled?: boolean }) {
  const [copy, setCopy] = useState<ShareCopy | null>(null);
  const valid = shareCopy(draft, ownerId);
  const matches = copy && valid && JSON.stringify(copy) === JSON.stringify(valid);
  return <><RoyalNavButton label="Share a copy" icon="letter" disabled={disabled || !valid} onPress={() => setCopy(shareCopy(draft, ownerId))} />{matches && <SharePreview key={draft.generationId} copy={copy} ownerId={ownerId} onClose={() => setCopy(null)} />}</>;
}
function SharePreview({ copy, ownerId, onClose }: { copy: ShareCopy; ownerId: string; onClose: () => void }) {
  const [prepared, setPrepared] = useState<PreparedShare | null>(null); const [preparing, setPreparing] = useState(fileSharingAvailable); const [busy, setBusy] = useState(false); const locked = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  const nativePrepared = useRef<PreparedShare|null>(null);
  useEffect(()=>()=>nativePrepared.current?.dispose(),[]);
  useEffect(() => {
    let active = true; let result: PreparedShare | null = null;
    void prepareShare(copy, ownerId).then(value => { if (!active) value?.dispose(); else { result = value; setPrepared(value); } }).catch(() => { if (active) setNotice('The illustrated or audio copy could not be prepared. Your letter is safe; written words can still be shared below.'); }).finally(() => { if (active && (Platform.OS === 'web' || copy.kind === 'VOICE')) setPreparing(false); });
    return () => { active = false; result?.dispose(); };
  }, [copy, ownerId]);
  async function run(action: () => Promise<string>) {
    if (locked.current) return; locked.current = true; setBusy(true); setNotice(null);
    try { const result = await action(); setNotice(result === 'cancelled' ? 'Sharing cancelled. Your letter is still here.' : result === 'downloaded' ? 'Your copy is ready in Downloads. Your saved letter is unchanged.' : wordsAction === 'Copy written words' && result === 'copied' ? 'Words copied. Paste them into the app you choose.' : 'The share sheet has closed. Your saved letter is unchanged.'); }
    catch { setNotice('Sharing could not finish. Try saving a copy or choosing another app.'); }
    finally { locked.current = false; setBusy(false); }
  }
  const words = copy.kind === 'TEXT' ? copy.text : copy.caption;
  return <StoryDialog title="A copy beyond the palace." onClose={() => { if (!busy) onClose(); }}>
    <Text style={s.body}>Anyone you share with may keep or forward this copy. This leaves your draft here and makes no delivery or publication in Lantern Post.</Text>
    {copy.kind === 'TEXT' ? prepared?.previewUri ? <Image testID="share-letter-preview" source={{ uri: prepared.previewUri }} style={{ width: '100%', aspectRatio: 1080 / 1500 }} resizeMode="contain" accessibilityLabel="Your illustrated letter, ready to share" /> : <PaperFrame preset={copy.preset}><Text style={[s.body, stationeryFont(copy.preset.config), { color: copy.preset.config.inkColor }]}>{copy.text}</Text></PaperFrame> : <LocalVoicePlayer ownerId={ownerId} clip={copy.voice} caption={copy.caption} />}
    <Text style={s.body}>{fileSharingNote}</Text>
    {preparing && <Text accessibilityLiveRegion="polite" style={s.body}>Preparing your {copy.kind === 'VOICE' ? 'recording' : 'illustrated pages'}…</Text>}
    {!prepared && <ShareRenderer copy={copy} ownerId={ownerId} onReady={value=>{nativePrepared.current=value;setPrepared(value);setPreparing(false);}} onError={()=>{setPreparing(false);setNotice('The illustrated copy could not be prepared. You can still share written words.');}} />}
    {prepared && <View style={{ gap: 12 }}>{canShareFiles(prepared) && (prepared.nativeFiles && prepared.nativeFiles.length>1 ? prepared.nativeFiles.map((_,index)=><StoryButton key={index} label={`Share illustrated page ${index+1}`} disabled={busy} onPress={()=>{void run(()=>shareFiles(prepared,index));}} />) : <StoryButton label={copy.kind === 'VOICE' ? 'Share recording' : 'Share illustrated letter'} disabled={busy} onPress={() => { void run(() => shareFiles(prepared)); }} />)}{supportsDownload && <StoryButton label={copy.kind === 'VOICE' ? 'Save recording' : `Save illustrated ${prepared.files.length > 1 ? 'pages' : 'letter'}`} disabled={busy} secondary onPress={() => { void run(async () => { downloadShare(prepared); return 'downloaded'; }); }} />}</View>}
    {Boolean(words) && <StoryButton label={copy.kind === 'VOICE' ? `${wordsAction} only` : wordsAction} disabled={busy} secondary onPress={() => { void run(async () => { const result = await shareWords(words); return result === 'shared' && wordsAction === 'Copy written words' ? 'copied' : result; }); }} />}
    {notice && <Text role="status" style={s.body}>{notice}</Text>}
    <StoryButton label="Keep writing here" secondary disabled={busy} onPress={onClose} />
  </StoryDialog>;
}
