import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { ChatMessage, ChatPage } from '@lantern-post/shared-types';
import { ChatDraftController } from './chat-draft';
import { ChatSession } from './chat-session';
import { CHAT_LIMIT, mergeMessages, validMessage } from './chat-contract';
import type { ChatTransport } from './chat-contract';
import { draftStorage } from '../letters/draft-storage';
import { StoryButton, StoryDialog, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { RoyalNavButton } from '../storybook/royal-navigation';
import { PalaceCrest } from '../letters/antique-assets';
import { CharacterArt } from '../storybook/character-art';
import { Flourish, StoryIcon } from '../storybook/ornaments';
import { serif } from '../storybook/theme';
import { useAppActive } from '../storybook/use-ambient-motion';
import { BlockPalaceDialog, ReportLetterDialog } from '../safety/safety-controls';
import type { SafetyTransport } from '../safety/safety-api';
import { SupportCard } from '../safety/support-card';
import { mightNeedSupport } from '../safety/support-resources';
import { usePalaceConnection, watchPalaceEvents } from '../realtime/palace-live-state';

export function ChatRoom({ ownerId, peerId, api, safety, onBack, focused = true }: { ownerId: string; peerId: string; api: ChatTransport; safety: SafetyTransport; onBack: () => void; focused?: boolean }) {
  const [draft] = useState(() => new ChatDraftController(ownerId, peerId, draftStorage));
  const [session] = useState(() => new ChatSession(peerId, api, draft, randomUUID));
  const saved = useSyncExternalStore(draft.subscribe, draft.getSnapshot, draft.getSnapshot);
  const live = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [sample, setSample] = useState(false); const [history, setHistory] = useState<ChatPage | null>(null); const [loadingHistory, setLoadingHistory] = useState(false);
  const [reporting, setReporting] = useState<{ message: ChatMessage; username: string } | null>(null); const [blocking, setBlocking] = useState(false);
  const [managing, setManaging] = useState<{ messageId: string; side: ChatMessage['side']; scope: 'self' | 'everyone' | null } | null>(null);
  const [removing, setRemoving] = useState(false), [removeError, setRemoveError] = useState(false);
  const historyRef = useRef(history), mounted = useRef(true);
  useEffect(() => { historyRef.current = history; }, [history]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const active = useAppActive(); const running = active && focused && !sample;
  const accountConnected = usePalaceConnection(ownerId);
  useEffect(() => {
    if (!running) return;
    let live = true;
    const refresh = () => {
      void session.synchronize();
      const before = historyRef.current;
      if (before?.messages.length) void session.syncPage(before.messages.map(message => message.id)).then(rows => {
        if (!live || !rows) return;
        const visible = new Set(rows.map(message => message.id));
        setHistory(current => current !== before ? current : { ...before, messages: mergeMessages(before.messages.filter(message => visible.has(message.id)), rows) });
      });
    };
    if (accountConnected) refresh();
    const stop = watchPalaceEvents(ownerId, event => { if (event.peerId === peerId && (event.kind === 'CHAT_CHANGED' || event.kind === 'GATES_CHANGED')) refresh(); });
    return () => { live = false; stop(); };
  }, [running, accountConnected, ownerId, peerId, session]);
  const { width } = useWindowDimensions();
  useEffect(() => { draft.load(); return draft.watch(); }, [draft]);
  useEffect(() => { if (running) session.start(); else session.stop(); return () => session.stop(); }, [running, session]);
  useEffect(() => { if (!running || Platform.OS !== 'web') return; const online = () => session.start(); window.addEventListener('online', online); return () => window.removeEventListener('online', online); }, [running, session]);
  const reportApi = useMemo<SafetyTransport>(() => ({ ...safety, report: (id, input) => api.report(id, input) }), [api, safety]);
  const text = saved.draft?.text ?? ''; const pending = Boolean(saved.draft?.requestId); const closed = live.phase === 'closed'; const peer = live.peer;
  const managedMessage = managing ? (history?.messages ?? live.messages).find(message => message.id === managing.messageId) : undefined;
  function leave() { if (!saved.saved && !draft.retrySave()) return; onBack(); }
  async function earlier() { const before = history ? history.before : live.before; if (!before || loadingHistory) return; setLoadingHistory(true); const page = await session.earlier(before); if (page) setHistory(page); setLoadingHistory(false); }
  async function removeMessage() {
    if (!managing?.scope || removing || !running) return;
    const { messageId, scope } = managing; setRemoving(true); setRemoveError(false);
    try {
      if (!await session.remove(messageId, scope)) throw Error('Message changed');
      if (!mounted.current) return;
      setHistory(current => current ? { ...current, messages: current.messages.flatMap(item => item.id !== messageId ? [item] : scope === 'self' ? [] : [{ ...item, text: 'This message was unsent.', removed: true }]) } : null);
      setManaging(null);
    } catch { if (mounted.current) setRemoveError(true); }
    finally { if (mounted.current) setRemoving(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><StoryShell chapter="THE KINDRED PARLOUR" beforeBellOpen={() => saved.saved || draft.retrySave()} actions={<TextAction label="Friendship court" onPress={leave} />}>
    <StoryHeading eyebrow="A LITTLE HELLO, BY LANTERN LIGHT" title={sample ? 'The sample parlour' : peer ? 'A conversation with @' + peer.username : 'The friendship parlour'} subtitle={sample ? 'A fictional conversation to try the room. No message leaves this device.' : 'Two familiar souls. A quiet table beneath the palace stars.'} />
    <View style={styles.header}><Image source={require('../../assets/storybook/writing-chamber.png')} style={StyleSheet.absoluteFill} resizeMode="cover" accessible={false} /><View style={styles.plaque}><PalaceCrest size={42} color="#CDB17C" /><View style={{ flex: 1, gap: 6 }}><Text style={styles.headerTitle}>{sample ? 'A room for trying things' : peer?.character?.palace.name ?? 'A place for kindred souls'}</Text><Text style={styles.headerNote}>{sample ? 'PREVIEW ONLY · SCRIPTED SAMPLE GUEST' : live.connected && live.available ? 'THE POST IS CONNECTED · MESSAGES ARRIVE LIVE' : 'THE PALACE KEEPS YOUR UNSENT WORDS'}</Text></View>{peer?.character && !sample && width > 450 && <CharacterArt characterKey={peer.character.key} size={78} />}</View></View>
    {sample ? <SampleParlour onReturn={() => setSample(false)} /> : <>
      <View style={styles.tools}>{peer && <RoyalNavButton label={'Close gate to ' + peer.username} icon="gate" compact onPress={() => setBlocking(true)} />}<RoyalNavButton label="Explore sample conversation" icon="star" compact onPress={() => setSample(true)} /></View>
      {live.phase === 'loading' ? <View style={styles.waiting}><ActivityIndicator color="#9A7A43" /><Text style={s.body}>Opening the parlour doors…</Text></View> : closed ? <View style={styles.closed}><StoryIcon kind="gate" size={40} /><Text style={styles.emptyTitle}>These gates are closed.</Text><Text style={s.body}>{live.error}</Text><RoyalNavButton label="Check the friendship gate" icon="key" onPress={() => session.start()} /></View> : <>
        <View style={styles.historyBar}>{(history?.before ?? (!history ? live.before : null)) && <TextAction label={loadingHistory ? 'Turning the page…' : 'Earlier messages'} disabled={loadingHistory || !running} onPress={() => { void earlier(); }} />}{history && <TextAction label="Return to latest messages" onPress={() => setHistory(null)} />}<Text style={styles.small}>{history ? 'An earlier page of your conversation' : live.connected ? 'Messages arrive here as they are delivered' : 'Waiting to reconnect…'}</Text></View>
        <Conversation messages={history?.messages ?? live.messages} peerName={peer?.username ?? 'your friend'} historical={Boolean(history)} onReport={message => setReporting({ message, username: peer?.username ?? 'your friend' })} onManage={api.remove ? message => { setRemoveError(false); setManaging({ messageId: message.id, side: message.side, scope: null }); } : undefined} />
      </>}
      {live.error && !closed && <Text role="status" style={styles.error}>{live.error}</Text>}
      {!live.available && !closed && live.phase !== 'loading' && <View style={styles.availability}><Text style={s.body}>Live chat is temporarily unavailable. Your words stay on this device. The sample conversation lets you explore the parlour.</Text><TextAction label="Check live chat availability" onPress={() => session.start()} /></View>}
      <View style={styles.composer}><Text style={styles.eyebrow}>YOUR NEXT LITTLE HELLO</Text>
        {saved.phase === 'error' ? <><Text role="alert" style={styles.error}>{saved.notice}</Text><RoyalNavButton label="Restore saved message" icon="key" onPress={() => draft.load()} /></> : <>
          <TextInput accessibilityLabel="Your chat message" multiline value={text} onChangeText={value => draft.edit(value)} editable={!pending && !closed} maxLength={2000} placeholder="Leave a little light in their day…" placeholderTextColor="#9E8763" textAlignVertical="top" style={styles.input} />
          <View style={styles.sendRow}><Text style={styles.small}>{Array.from(text).length} / {CHAT_LIMIT.toLocaleString()} · saved on this device</Text><RoyalNavButton label={live.sending ? 'Sending message…' : 'Send message'} icon="letter" primary disabled={!running || live.phase !== 'ready' || !live.available || !saved.saved || pending || !validMessage(text)} onPress={() => { void session.send(); }} /></View>
          {pending && <View style={styles.pending}><Text style={s.body}>Your confirmed message is waiting for its receipt. Keep the same message while the post checks its journey.</Text><View style={styles.tools}><TextAction label="Check or retry this message" disabled={!running || live.sending} onPress={() => { void session.recover(); }} /><TextAction label="Cancel sending and keep words" disabled={!running} onPress={() => { void session.cancel(); }} /></View></View>}
          {saved.notice && <Text role="status" style={styles.small}>{saved.notice}</Text>}
          {!saved.saved && <RoyalNavButton label="Retry saving message" icon="key" onPress={() => { if (draft.retrySave()) void session.recover(); }} />}
          <SupportCard visible={mightNeedSupport(text)} />
        </>}
      </View>
    </>}
    {blocking && peer && <BlockPalaceDialog ownerId={ownerId} person={peer} api={safety} onClose={() => setBlocking(false)} onSaved={() => { setBlocking(false); setHistory(null); session.start(); }} />}
    {reporting && <ReportLetterDialog ownerId={ownerId} letterId={reporting.message.id} sender={{ username: reporting.username }} api={reportApi} item="message" onClose={() => setReporting(null)} onBlocked={() => { setReporting(null); setHistory(null); session.start(); }} />}
    {running && managing && <StoryDialog title={managing.scope === 'everyone' ? 'Unsend this message?' : managing.scope === 'self' ? 'Delete this message for you?' : 'Message options'} onClose={() => { if (!removing) setManaging(null); }} footer={managing.scope ? <>
      <StoryButton label={removing ? 'Removing message…' : managing.scope === 'everyone' ? 'Confirm unsend' : 'Confirm delete for me'} busy={removing} disabled={closed} onPress={() => { void removeMessage(); }} />
      <StoryButton label="Keep message" secondary disabled={removing} onPress={() => setManaging(null)} />
    </> : <>
      <StoryButton label="Delete for me" secondary onPress={() => setManaging({ ...managing, scope: 'self' })} />
      {managing.side === 'mine' && managedMessage && !managedMessage.removed && <StoryButton label="Unsend for everyone" secondary onPress={() => setManaging({ ...managing, scope: 'everyone' })} />}
      <TextAction label="Close message options" onPress={() => setManaging(null)} />
    </>}>
      <Text numberOfLines={3} style={s.body}>{managedMessage?.text ?? 'This message is no longer in your history.'}</Text>
      <Text style={s.body}>{managing.scope === 'everyone' ? 'Its text will be removed from both sides of this conversation. Copies already read, shared or backed up cannot be recalled.' : managing.scope === 'self' ? 'This message will be removed from your chat history. Your friend keeps their copy.' : 'Choose whether to remove your copy or withdraw a message you sent.'}</Text>
      {removeError && <Text role="alert" style={s.body}>The message could not be removed. Your conversation is kept; please try again.</Text>}
    </StoryDialog>}
  </StoryShell></KeyboardAvoidingView>;
}
function Conversation({ messages, peerName, onReport, onManage, historical = false }: { messages: ChatMessage[]; peerName: string; onReport?: (message: ChatMessage) => void; onManage?: (message: ChatMessage) => void; historical?: boolean }) {
  const { height } = useWindowDimensions(); const scroll = useRef<ScrollView>(null); const nearBottom = useRef(true); const [below, setBelow] = useState(false);
  return <View style={styles.conversation}><View style={[styles.conversationInset, { pointerEvents: "none" }]} /><View style={styles.mantel}><Flourish width={110} /><Text style={styles.eyebrow}>WORDS BETWEEN TWO PALACES</Text><Flourish width={110} /></View>
    <ScrollView ref={scroll} testID="chat-transcript" nestedScrollEnabled showsVerticalScrollIndicator keyboardShouldPersistTaps="handled" style={{ height: Math.max(290, Math.min(480, height * .46)), flexGrow: 0, flexShrink: 0 }} contentContainerStyle={styles.messages} onScrollBeginDrag={() => { nearBottom.current = false; }} onScroll={event => { const e = event.nativeEvent; nearBottom.current = e.contentOffset.y + e.layoutMeasurement.height >= e.contentSize.height - 80; if (nearBottom.current) setBelow(false); }} scrollEventThrottle={32}
      onContentSizeChange={() => { if (!historical && nearBottom.current) scroll.current?.scrollToEnd({ animated: false }); else if (!historical) setBelow(true); }}>
      {!messages.length ? <View style={styles.waiting}><PalaceCrest size={57} /><Text style={styles.emptyTitle}>The first hello is yours.</Text><Text style={styles.small}>A little conversation can begin with a single kind word.</Text></View> : messages.map(message => <View key={message.id} testID={'chat-message-' + message.sequence} style={[styles.message, message.side === 'mine' && styles.mine]}><View style={styles.postmark}><StoryIcon kind="star" size={12} color="#AD8A4D" /><Text style={styles.messageName}>{message.side === 'mine' ? 'YOU' : '@' + peerName}</Text><Text style={styles.date}>{new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>{onManage && <Pressable accessibilityRole="button" accessibilityLabel={'Message options ' + message.sequence} onPress={() => onManage(message)} style={{ minWidth: 44, minHeight: 44, marginLeft: 'auto', justifyContent: 'center', alignItems: 'center' }}><Text style={s.body}>•••</Text></Pressable>}</View><Text selectable style={[styles.messageText, message.removed && { fontSize: 14, fontStyle: 'italic' }]}>{message.text}</Text>{message.side === 'theirs' && !message.removed && onReport && <TextAction label={'Report message ' + message.sequence} onPress={() => onReport(message)} />}</View>)}
    </ScrollView>
    {below && <TextAction label="New words below" onPress={() => { nearBottom.current = true; setBelow(false); scroll.current?.scrollToEnd({ animated: false }); }} />}
  </View>;
}
function SampleParlour({ onReturn }: { onReturn: () => void }) {
  const [text, setText] = useState(''); const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'sample-1', sequence: 1, side: 'theirs', text: 'Welcome to this little sample parlour. Shall we sit beside the lantern?', createdAt: new Date().toISOString() }]);
  function send() { if (!validMessage(text)) return; setMessages(old => { const next = (old[old.length - 1]?.sequence ?? 0) + 1; return [...old, { id: 'sample-' + next, sequence: next, side: 'mine' as const, text: text.trim(), createdAt: new Date().toISOString() }, { id: 'sample-' + (next + 1), sequence: next + 1, side: 'theirs' as const, text: 'A little light, received. This is a scripted sample reply; no friend has been messaged.', createdAt: new Date().toISOString() }].slice(-30); }); setText(''); }
  return <><View style={styles.sampleNotice}><Text style={styles.eyebrow}>PREVIEW ONLY · NOT A LIVE CONVERSATION</Text><Text style={s.body}>These messages stay in this sample room. Your real conversation and saved message are untouched.</Text><RoyalNavButton label="Return to live chat" icon="gate" onPress={onReturn} /></View><Conversation messages={messages} peerName="sample_guest" /><View style={styles.composer}><TextInput accessibilityLabel="Sample chat message" multiline value={text} maxLength={2000} onChangeText={setText} placeholder="Try a little hello…" placeholderTextColor="#9E8763" style={styles.input} /><RoyalNavButton label="Send sample message" icon="letter" primary disabled={!validMessage(text)} onPress={send} /></View></>;
}
const styles = StyleSheet.create({ header: { borderTopLeftRadius: 70, borderTopRightRadius: 70, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, borderWidth: 1, borderColor: '#B2945B', overflow: 'hidden', minHeight: 130, justifyContent: 'center' }, plaque: { flexDirection: 'row', alignItems: 'center', gap: 20, padding: 24, backgroundColor: 'rgba(53,44,32,.76)' }, headerTitle: { color: '#F0DDBC', fontFamily: serif, fontSize: 25 }, headerNote: { color: '#D2B989', fontSize: 8, letterSpacing: 1.3, lineHeight: 15 }, tools: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14, marginVertical: 15 }, historyBar: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginVertical: 10 }, conversation: { backgroundColor: '#EDE2CB', borderColor: '#AC8D58', borderWidth: 1, borderRadius: 6, overflow: 'hidden' }, conversationInset: { ...StyleSheet.absoluteFill, margin: 6, borderWidth: 1, borderColor: '#D4BD8C', borderRadius: 3 }, mantel: { padding: 16, borderBottomWidth: 1, borderColor: '#D0B98A', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12 }, eyebrow: { color: '#8C7142', fontSize: 8, lineHeight: 15, letterSpacing: 1.8 }, messages: { padding: 20, gap: 18 }, message: { maxWidth: '90%', alignSelf: 'flex-start', padding: 17, borderWidth: 1, borderColor: '#B6AD87', borderTopLeftRadius: 23, borderTopRightRadius: 5, borderBottomLeftRadius: 5, borderBottomRightRadius: 18, backgroundColor: '#EEF0DC', gap: 10, boxShadow: '0px 3px 7px rgba(75,54,24,.07)' }, mine: { alignSelf: 'flex-end', backgroundColor: '#FFF2D6', borderColor: '#CFB27A', borderTopLeftRadius: 5, borderTopRightRadius: 23 }, postmark: { flexDirection: 'row', alignItems: 'center', gap: 9, flexWrap: 'wrap' }, messageName: { fontSize: 8, letterSpacing: 1.5, color: '#8B714A' }, date: { fontSize: 9, color: '#95815F' }, messageText: { color: '#55442E', fontFamily: serif, fontSize: 18, lineHeight: 27 }, waiting: { alignItems: 'center', gap: 18, padding: 30 }, emptyTitle: { fontFamily: serif, color: '#725837', fontSize: 26, textAlign: 'center' }, small: { color: '#857251', fontSize: 11, lineHeight: 20 }, closed: { padding: 26, gap: 20, alignItems: 'center', borderWidth: 1, borderColor: '#BBA276', backgroundColor: '#EFE3C9', marginTop: 22 }, availability: { backgroundColor: '#EEE4CF', padding: 18, borderColor: '#D0B98B', borderWidth: 1, marginTop: 15 }, composer: { marginTop: 18, backgroundColor: '#F4E7CC', padding: 20, borderWidth: 1, borderColor: '#BBA06D', borderRadius: 5, gap: 14 }, input: { minHeight: 100, padding: 15, color: '#59432C', fontFamily: serif, fontSize: 18, lineHeight: 27, backgroundColor: '#FFF6E1', borderColor: '#C7AE7C', borderWidth: 1, borderRadius: 3, textAlignVertical: 'top' }, sendRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 15 }, pending: { padding: 12, backgroundColor: '#E8DABB', borderWidth: 1, borderColor: '#C4AC7A' }, error: { color: '#924E3B', fontSize: 13, lineHeight: 21, paddingVertical: 12 }, sampleNotice: { padding: 22, gap: 16, backgroundColor: '#EEE3D6', borderWidth: 1, borderColor: '#BEA682', marginVertical: 18 } });
