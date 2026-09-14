import { useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { StoryDialog, s } from '../storybook/story-ui';
import { RoyalNavButton } from '../storybook/royal-navigation';
import { Flourish } from '../storybook/ornaments';
import { PalaceCrest } from '../letters/antique-assets';
import { serif } from '../storybook/theme';
import { canCopyUsername, copyUsername, shareUsername } from './username-share';
export function UsernameCard({ username }: { username: string }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  const sharing = useRef(false);
  async function share(copy: boolean) {
    if (sharing.current) return; sharing.current = true; setBusy(true); setNotice(null);
    try { if (copy) { await copyUsername(username); setNotice('Username copied. Your friend can paste it into the friendship court.'); } else { const result = await shareUsername(username); setNotice(result === 'cancelled' ? 'Your calling card is still here.' : result === 'copied' ? 'Calling card copied. Paste it into the app you choose.' : 'The share sheet has closed.'); } }
    catch { setNotice('Sharing could not finish. You can select and copy the username on your card.'); }
    finally { sharing.current = false; setBusy(false); }
  }
  return <><RoyalNavButton label="Share my username" icon="key" onPress={() => { setNotice(null); setOpen(true); }} compact />{open && <StoryDialog title="A royal calling card." onClose={() => { if (!busy) setOpen(false); }}>
    <View testID="username-calling-card" style={styles.card}><Image source={require('../../assets/storybook/paper-texture-vellum.png')} style={StyleSheet.absoluteFill} resizeMode="stretch" accessible={false} /><View style={[styles.inset, { pointerEvents: "none" }]} /><Text style={styles.eyebrow}>THE COURT OF KINDRED SOULS</Text><PalaceCrest size={67} /><Text selectable style={styles.username}>@{username}</Text><Text style={styles.caption}>A name opens the way to my palace.</Text><Flourish width={164} /><Text style={styles.brand}>THE LANTERN POST</Text></View>
    <Text style={s.body}>Share your username with someone you know. They can find you in the friendship court and leave an invitation at your gate.</Text>
    <RoyalNavButton label="Share username" icon="letter" primary disabled={busy} onPress={() => { void share(false); }} />
    {canCopyUsername ? <RoyalNavButton label="Copy username" icon="key" disabled={busy} onPress={() => { void share(true); }} /> : <Text style={s.body}>Press and hold your username to select and copy it.</Text>}
    {notice && <Text role="status" style={s.body}>{notice}</Text>}
  </StoryDialog>}</>;
}
const styles = StyleSheet.create({ card: { padding: 26, gap: 16, alignItems: 'center', backgroundColor: '#F0E2C3', borderWidth: 1, borderColor: '#AF8E53', borderTopLeftRadius: 58, borderTopRightRadius: 58, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, overflow: 'hidden' }, inset: { ...StyleSheet.absoluteFill, margin: 7, borderColor: '#CDB681', borderWidth: 1, borderTopLeftRadius: 51, borderTopRightRadius: 51, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }, eyebrow: { color: '#8A7042', fontSize: 8, letterSpacing: 1.6, textAlign: 'center' }, username: { color: '#59432A', fontSize: 27, fontFamily: serif, textAlign: 'center' }, caption: { color: '#826A46', fontSize: 14, fontFamily: serif, fontStyle: 'italic', textAlign: 'center' }, brand: { color: '#806638', fontSize: 9, letterSpacing: 2.1 } });
