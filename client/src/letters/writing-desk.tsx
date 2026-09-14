import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { CharacterKey, LetterPreset } from '@lantern-post/shared-types';
import { ActionButton, AuthPage, LoadingScreen } from '../components/auth-ui';
import { Flourish, StoryIcon } from '../storybook/ornaments';
import { StoryButton, StoryDialog, StoryShell, TextAction, s } from '../storybook/story-ui';
import { gold, ink, line, mutedInk, serif } from '../storybook/theme';
import { characterCount, draftProblem, LETTER_LIMIT, letterProblem, terminalStage } from './draft';
import { MiniStationery, PaperFrame, stationeryFont } from './stationery';
import { useLetterDraft } from './use-letter-draft';
import { SealedEnvelope } from './sealed-envelope';
import { BurningWorld } from './burning-world';
import { BurnController } from './burn-controller';
import type { BurnTransport } from './burn-controller';
import { DeliveryController } from './delivery-controller';
import type { DeliveryTransport } from './delivery-controller';
import type { FriendsTransport } from '../friends/friends-api';
import { FriendDeliveryFlow } from './friend-delivery-flow';
import { VoiceComposer, LocalVoicePlayer } from '../voice/voice-composer';
import { useVoiceCleanup } from '../voice/use-voice-cleanup';
import { voiceTime } from '../voice/voice-contract';
import { WorldController } from '../infinity/world-controller';
import type { WorldDeliveryTransport } from '../infinity/world-controller';
import { WorldDeliveryFlow } from '../infinity/world-delivery-flow';
import { usePendingRecovery } from './use-pending-recovery';
import type { RecoveryWork } from './recovery-scheduler';
import { SupportCard } from '../safety/support-card';
import { mightNeedSupport } from '../safety/support-resources';
import { useDiagnostics } from '../diagnostics/diagnostics-context';
import type { DraftController } from './draft';
import { LetterWorkspace } from './letter-workspace';
import { DeskCompanion } from './desk-companion';
import { ShareLetter } from './share-letter';

type WritingDeskProps = {
  ownerId: string; presets: LetterPreset[]; catalogUnavailable?: boolean; refreshing?: boolean; onRetryCatalog: () => void; onBack: () => void; burnTransport?: BurnTransport;
  deliveryTransport?: DeliveryTransport; friendsTransport?: FriendsTransport; characterKey?: CharacterKey; initialRecipientId?: string; onFriends?: () => void;
  worldTransport?: WorldDeliveryTransport; onExploreWorld?: () => void;
};
export function WritingDesk(props: WritingDeskProps) {
  return <LetterWorkspace ownerId={props.ownerId} onBack={props.onBack}>{(controller, onNew, onBusy) => <LetterEditor key={controller.key} {...props} draftController={controller} onNew={onNew} onBusy={onBusy} />}</LetterWorkspace>;
}
function LetterEditor({ ownerId, presets, catalogUnavailable = false, refreshing = false, onRetryCatalog, onBack, burnTransport, deliveryTransport, friendsTransport, characterKey, initialRecipientId, onFriends, worldTransport, onExploreWorld, draftController, onNew, onBusy }: WritingDeskProps & { draftController: DraftController; onNew: () => void; onBusy: (busy: boolean) => void }) {
  const { controller, phase, draft, save, notice } = useLetterDraft(ownerId, draftController);
  const { width } = useWindowDimensions();
  const [animateSeal, setAnimateSeal] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [showBurn, setShowBurn] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recording, setRecording] = useState(false); const [writing, setWriting] = useState(false);
  const writingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (writingTimer.current) clearTimeout(writingTimer.current); }, []);
  function write(text: string) { controller.edit(text); setWriting(true); if (writingTimer.current) clearTimeout(writingTimer.current); writingTimer.current = setTimeout(() => setWriting(false), 1400); }
  useEffect(() => { onBusy(recordingBusy); return () => onBusy(false); }, [onBusy, recordingBusy]);
  const [switchKind, setSwitchKind] = useState<'TEXT' | 'VOICE' | null>(null);
  const voiceCleanup = useVoiceCleanup(controller, ownerId, draft?.voiceDeletes ?? []);
  const diagnostics = useDiagnostics();
  useEffect(() => { if (draft?.stage === 'burned' && draft.burnRequestId) diagnostics.track({ name: 'BURN_COMPLETED', requestId: draft.burnRequestId }, `burn:${draft.burnRequestId}`); else if (draft?.stage === 'delivered' && draft.deliveryRequestId) diagnostics.track({ name: 'FRIEND_DELIVERED', requestId: draft.deliveryRequestId }, `friend:${draft.deliveryRequestId}`); else if (draft?.stage === 'published' && draft.worldRequestId) diagnostics.track({ name: 'WORLD_SHARED', requestId: draft.worldRequestId }, `world:${draft.worldRequestId}`); }, [diagnostics, draft]);
  const [showWorld, setShowWorld] = useState(false);
  const [worldCourier] = useState(() => new WorldController(controller, worldTransport ?? { submit: async () => { throw new Error('World unavailable'); }, lookup: async () => { throw new Error('World unavailable'); }, cancel: async () => { throw new Error('World unavailable'); }, capabilities: async () => ({ textAvailable: false, voiceAvailable: false }) }, randomUUID));
  const sharing = useSyncExternalStore(worldCourier.subscribe, worldCourier.getSnapshot, worldCourier.getSnapshot);
  const [courier] = useState(() => new DeliveryController(controller, deliveryTransport ?? {
    submit: async () => { throw new Error('Delivery unavailable'); }, lookup: async () => { throw new Error('Delivery unavailable'); }, cancel: async () => { throw new Error('Delivery unavailable'); }, capabilities: async () => ({ textAvailable: false }),
  }, randomUUID));
  const delivery = useSyncExternalStore(courier.subscribe, courier.getSnapshot, courier.getSnapshot);
  const [burner] = useState(() => new BurnController(controller, burnTransport ?? {
    submit: async () => { throw new Error('Release service unavailable'); },
    lookup: async () => { throw new Error('Release service unavailable'); },
  }, randomUUID));
  const burn = useSyncExternalStore(burner.subscribe, burner.getSnapshot, burner.getSnapshot);
  const recoveryWork = useMemo<RecoveryWork>(() => ({
    identity: () => { const d = controller.getSnapshot().draft; return d?.stage === 'burn-pending' ? `${ownerId}:burn:${d.burnRequestId}` : d?.stage === 'delivery-pending' ? `${ownerId}:friend:${d.deliveryRequestId}` : d?.stage === 'world-pending' ? `${ownerId}:world:${d.worldRequestId}` : null; },
    busy: () => burner.getSnapshot().busy || courier.getSnapshot().busy || worldCourier.getSnapshot().busy,
    check: async () => { const stage = controller.getSnapshot().draft?.stage; if (stage === 'burn-pending') await burner.check(); else if (stage === 'delivery-pending') await courier.check(); else if (stage === 'world-pending') await worldCourier.check(); },
    permitted: async () => { const d = controller.getSnapshot().draft; if (d?.stage === 'burn-pending') return Boolean(burnTransport); if (d?.stage === 'delivery-pending' && deliveryTransport) { const c = await deliveryTransport.capabilities(); return d.kind === 'TEXT' ? c.textAvailable : Boolean(c.voiceStorageAvailable && c.voiceAvailable && (!d.voiceCaption || c.textAvailable)); } if (d?.stage === 'world-pending' && worldTransport) { const c = await worldTransport.capabilities(); return d.kind === 'TEXT' ? c.textAvailable : c.voiceAvailable && (!d.voiceCaption || c.textAvailable); } return false; },
    retry: async () => { const stage = controller.getSnapshot().draft?.stage; if (stage === 'burn-pending') await burner.retry(); else if (stage === 'delivery-pending') await courier.retry(); else if (stage === 'world-pending') await worldCourier.retry(); },
  }), [burner, courier, worldCourier, controller, ownerId, burnTransport, deliveryTransport, worldTransport]);
  usePendingRecovery(recoveryWork, recoveryWork.identity());
  const finishSeal = useCallback(() => setAnimateSeal(false), []);
  const finishBurn = useCallback(() => {
    const state = controller.getSnapshot();
    if (state.draft?.stage === 'burned' && state.save === 'saved' && !state.draft.voiceDeletes.length) onBack();
  }, [controller, onBack]);
  const writeAgain = useCallback(() => {
    const state = controller.getSnapshot();
    if (terminalStage(state.draft?.stage) && state.save === 'saved' && !state.draft?.voiceDeletes.length) onNew();
  }, [controller, onNew]);
  useEffect(() => {
    if (phase === 'ready' && draft?.stage === 'burn-pending') void burner.check();
  }, [burner, draft?.burnRequestId, draft?.stage, phase]);
  useEffect(() => { if (phase === 'ready' && draft?.stage === 'delivery-pending') void courier.check(); }, [courier, draft?.deliveryRequestId, draft?.stage, phase]);
  useEffect(() => { if (phase === 'ready' && draft?.stage === 'world-pending') void worldCourier.check(); }, [worldCourier, draft?.worldRequestId, draft?.stage, phase]);
  useEffect(() => {
    if (phase === 'ready' && draft && !draft.preset && presets[0]) controller.choosePreset(presets[0]);
  }, [controller, draft, phase, presets]);
  if (phase === 'loading') return <LoadingScreen />;
  if (phase === 'load-error' || !draft) return <AuthPage title="Your letter needs a little care" subtitle="We couldn’t restore your saved draft. Try again before starting a fresh page.">
    <ActionButton label="Try restoring my draft" onPress={() => controller.load()} />
    <ActionButton label="Back to my palace" onPress={onBack} secondary />
    <ActionButton label="Start a fresh page" onPress={() => setDiscard(true)} secondary />
    {discard && <StoryDialog title="Start a fresh page?" onClose={() => setDiscard(false)}><Text style={s.body}>This replaces the saved draft on this device. Its words cannot be restored.</Text>{save === 'error' && <Text role="alert" style={styles.error}>We couldn’t save the new page. Your previous draft has been kept.</Text>}<StoryButton label="Replace the draft" onPress={() => { if (controller.reset()) setDiscard(false); }} /><StoryButton label="Keep my draft" onPress={() => setDiscard(false)} secondary /></StoryDialog>}
  </AuthPage>;
  const selected = draft.preset;
  const fullySaved = save === 'saved' && !voiceCleanup.pending;
  function goBack() {
    if (recordingBusy) return;
    if (save === 'error' && !controller.retrySave()) return;
    onBack();
  }
  if ((draft.stage === 'world-pending' || draft.stage === 'published') && !worldTransport) return <AuthPage title="Your letter is held safely" subtitle="Return to your palace and reopen the writing desk to check the sky’s reply."><ActionButton label="My palace" onPress={onBack} /></AuthPage>;
  if (worldTransport && (draft.stage === 'world-pending' || draft.stage === 'published' || (showWorld && draft.stage === 'sealed' && sharing.outcome !== 'REJECTED'))) return <WorldDeliveryFlow key={draft.generationId} draft={draft} controller={controller} api={worldTransport} courier={characterKey} saved={fullySaved} busy={sharing.busy} error={voiceCleanup.error ?? sharing.error}
    onConfirm={() => { void worldCourier.confirm(); }} onKeep={() => setShowWorld(false)} onRetry={() => { void worldCourier.retry(); }} onCheck={() => { void worldCourier.check(); }} onCancel={() => { void worldCourier.cancel(); }} onCleanup={() => { worldCourier.retryCleanup(); void voiceCleanup.retry(); }} onBack={goBack} onWrite={writeAgain}
    onExplore={() => { const state = controller.getSnapshot(); if (state.draft?.stage === 'published' && state.save === 'saved' && !state.draft.voiceDeletes.length) (onExploreWorld ?? onBack)(); }} />;
  if ((draft.stage === 'delivery-pending' || draft.stage === 'delivered') && (!deliveryTransport || !friendsTransport)) return <AuthPage title="Your letter is held safely" subtitle="The delivery service is unavailable in this view. Return to your palace and open the writing desk again to check its reply."><ActionButton label="My palace" onPress={onBack} /></AuthPage>;
  if (deliveryTransport && friendsTransport && (draft.stage === 'delivery-pending' || draft.stage === 'delivered' || (showFriends && draft.stage === 'sealed' && delivery.outcome !== 'REJECTED'))) {
    return <FriendDeliveryFlow key={draft.generationId} draft={draft} saved={fullySaved} busy={delivery.busy} error={voiceCleanup.error ?? delivery.error} api={deliveryTransport} friends={friendsTransport} courier={characterKey} initialRecipientId={initialRecipientId}
      onConfirm={recipient => { void courier.confirm(recipient); }} onKeep={() => setShowFriends(false)} onRetry={() => { void courier.retry(); }} onCheck={() => { void courier.check(); }} onCancel={() => { void courier.cancel(); }} onCleanup={() => { courier.retryCleanup(); void voiceCleanup.retry(); }} onBack={goBack} onFriends={onFriends}
      onFinish={() => { const state = controller.getSnapshot(); if (state.draft?.stage === 'delivered' && state.save === 'saved' && !state.draft.voiceDeletes.length) onBack(); }} />;
  }
  if (draft.stage === 'burn-pending' || draft.stage === 'burned' || (showBurn && draft.stage === 'sealed' && burn.outcome !== 'REJECTED')) {
    return <BurningWorld key={draft.generationId} stage={draft.stage === 'sealed' ? 'confirm' : draft.stage === 'burn-pending' ? 'pending' : 'burned'} preset={selected} busy={burn.busy} saved={fullySaved} error={voiceCleanup.error ?? burn.error}
      onConfirm={() => { void burner.confirm(); }} onKeep={() => setShowBurn(false)} onRetry={() => { void burner.retry(); }} onCheck={() => { void burner.check(); }}
      onCleanup={() => { burner.retryCleanup(); void voiceCleanup.retry(); }} onBack={goBack} onFinish={finishBurn} onWriteAgain={writeAgain} />;
  }
  if (draft.stage === 'sealed' && selected) return <SealedEnvelope preset={selected} animate={animateSeal} onFinished={finishSeal} onUnseal={() => { setShowBurn(false); setShowFriends(false); setShowWorld(false); controller.unseal(); if (burn.outcome === 'REJECTED' || delivery.outcome === 'REJECTED' || sharing.outcome === 'REJECTED') onRetryCatalog(); }} onBack={goBack}
    onWorld={worldTransport ? () => { worldCourier.clearNotice(); setShowFriends(false); setShowBurn(false); setShowWorld(true); } : undefined}
    voicePreview={<View style={{ gap: 18 }}>{draft.voice && <LocalVoicePlayer ownerId={ownerId} clip={draft.voice} caption={draft.voiceCaption} />}<View style={{ alignSelf: 'center', width: '100%', maxWidth: 280 }}><ShareLetter draft={draft} ownerId={ownerId} disabled={animateSeal || !fullySaved} /></View></View>}
    onSend={burnTransport ? () => { burner.clearNotice(); setShowFriends(false); setShowBurn(true); } : undefined} onFriend={deliveryTransport && friendsTransport ? () => { courier.clearNotice(); setShowBurn(false); setShowFriends(true); } : undefined} notice={notice ?? delivery.error ?? burn.error ?? undefined} saveError={!fullySaved} onRetrySave={() => { controller.retrySave(); void voiceCleanup.retry(); }} />;
  const count = characterCount(draft.text);
  const over = count > LETTER_LIMIT;
  const stylesToShow = selected && !presets.some(p => p.id === selected.id) ? [selected, ...presets] : presets;
  function keyboardPreset(event: KeyboardEvent<HTMLElement>, index: number) {
    const delta = ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + stylesToShow.length) % stylesToShow.length;
    controller.choosePreset(stylesToShow[next]!);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }
  function seal() {
    Keyboard.dismiss();
    if (controller.seal()) { setAnimateSeal(true); diagnostics.track({ name: 'DRAFT_SEALED' }, `seal:${draft?.generationId}`); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StoryShell chapter="AT THE WRITING DESK" actions={<TextAction label="My palace" onPress={goBack} disabled={recordingBusy} />}>
      <View style={styles.masthead}>
        <Image source={require('../../assets/storybook/writing-chamber.png')} style={styles.background} resizeMode="cover" accessible={false} />
        <View style={styles.mastheadWords}><Text style={styles.mastheadEyebrow}>THE PALACE SCRIPTORIUM</Text><Text role="heading" style={[styles.mastheadTitle, width < 600 && { fontSize: 32, lineHeight: 42 }]}>A letter, by candlelight.</Text><Text style={styles.mastheadSubtitle}>Settle into the quiet. There is room for every word.</Text></View>
      </View>
      <View style={styles.steps}><Text style={styles.step}>I. THE PAGE</Text><View style={styles.stepLine} /><Text style={styles.step}>II. THE FINERY</Text><View style={styles.stepLine} /><Text style={styles.step}>III. THE SEAL</Text></View>
      <View accessibilityRole="tablist" style={styles.kindTabs}>{(['TEXT', 'VOICE'] as const).map(kind => <Pressable key={kind} accessibilityRole="tab" accessibilityState={{ selected: draft.kind === kind }} aria-selected={draft.kind === kind} disabled={recordingBusy || voiceCleanup.pending} onPress={() => {
        if (draft.kind === kind) return;
        if (draft.text.trim() || draft.voice) setSwitchKind(kind); else controller.changeKind(kind);
      }} style={[styles.kindTab, draft.kind === kind && styles.kindSelected]}><Text style={styles.kindText}>{kind === 'TEXT' ? 'A written letter' : 'A voice letter'}</Text></Pressable>)}</View>
      <View style={[styles.layout, width >= 950 && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <Image source={require('../../assets/storybook/desk-wood.png')} style={styles.background} resizeMode="stretch" accessible={false} />
        <View style={[styles.deskInset, { pointerEvents: "none" }]} />
        <View style={[styles.letterSide, width >= 950 && { flex: 1.7 }]}>
          {width < 950 && <DeskCompanion characterKey={characterKey} writing={writing} recording={recording} voice={draft.kind === 'VOICE'} compact />}
          <View style={styles.sectionHeader}><Text style={[s.eyebrow, { color: '#E0C593' }]}>YOUR PRIVATE CORRESPONDENCE</Text><Text style={[styles.save, save === 'error' && styles.error]} accessibilityLiveRegion="polite">{save === 'error' ? 'Not saved yet' : 'Saved on this device'}</Text></View>
          {selected ? <PaperFrame preset={selected}>
            {draft.kind === 'VOICE' ? <VoiceComposer key={draft.generationId} ownerId={ownerId} draft={controller} clip={draft.voice} caption={draft.voiceCaption} clearing={voiceCleanup.pending} onBusy={setRecordingBusy} onRecording={setRecording} /> : <TextInput accessibilityLabel="Your letter" multiline value={draft.text} onChangeText={write} onBlur={() => setWriting(false)}
              placeholder={'Dear whoever needs these words,\n\nThere is something on my mind…'} placeholderTextColor={`${selected.config.inkColor}80`}
              style={[styles.editor, width < 600 && { height: 320, fontSize: 17 }, stationeryFont(selected.config), { color: selected.config.inkColor, outlineColor: selected.config.ribbonColor }]}
              maxLength={20_000} textAlignVertical="top" autoCapitalize="sentences" autoCorrect scrollEnabled />}
          </PaperFrame> : <View style={styles.emptyPaper}><Flourish /><Text style={styles.emptyTitle}>Finding a beautiful page…</Text><Text style={s.body}>Your stationery is taking a moment to arrive.</Text><StoryButton label={refreshing ? 'Looking for stationery…' : 'Try again'} busy={refreshing} onPress={onRetryCatalog} secondary /></View>}
          <View style={styles.counterRow}><Text style={[styles.note, { color: '#E0CCA6' }]}>Kept here until you choose to release it</Text><Text testID="letter-counter" style={[styles.counter, over && { color: '#FFD1B5' }]}>{draft.kind === 'VOICE' ? `${voiceTime(draft.voice?.durationMs ?? 0)} / 3:00` : `${count.toLocaleString()} / ${LETTER_LIMIT.toLocaleString()}`}</Text></View>
          {draft.kind === 'TEXT' && over && <Text role="alert" style={[styles.error, { color: '#FFD1B5' }]}>{letterProblem(draft.text)}</Text>}
          <SupportCard key={draft.generationId} visible={mightNeedSupport(draft.kind === 'TEXT' ? draft.text : draft.voiceCaption)} />
          <View style={{ marginTop: 16, backgroundColor: '#F3E7CE', borderRadius: 4 }}><ShareLetter draft={draft} ownerId={ownerId} disabled={!fullySaved || recordingBusy} /></View>
          {voiceCleanup.pending && <View style={styles.saveError}><Text role="alert" style={styles.error}>{voiceCleanup.error ?? 'Clearing the old recording from this device…'}</Text>{voiceCleanup.error && <TextAction label="Retry clearing the recording" onPress={() => { void voiceCleanup.retry(); }} />}</View>}
          {notice && <Text role="alert" style={{ color: '#EAD8B9', fontSize: 12, lineHeight: 20 }}>{notice}</Text>}
          {save === 'error' && <View style={styles.saveError}><Text role="alert" style={styles.error}>We couldn’t save your latest changes. Keep this page open and try again.</Text><StoryButton label="Retry saving" onPress={() => controller.retrySave()} secondary /></View>}
        </View>
        <View style={[styles.stationerySide, width >= 950 && { flex: 1 }]}>
          {width >= 950 && <DeskCompanion characterKey={characterKey} writing={writing} recording={recording} voice={draft.kind === 'VOICE'} />}
          <Text style={s.eyebrow}>FROM THE ROYAL COLLECTION</Text><Text style={styles.asideTitle}>The stationery cabinet.</Text><Text style={[s.body, { textAlign: 'center', marginBottom: 20, fontSize: 12 }]}>Aged paper. Fine ribbon. A seal of your own.</Text>
          {catalogUnavailable && <View style={styles.catalogNotice}><Text style={styles.note}>{selected ? 'You can keep writing with your saved stationery while the others are unavailable.' : 'We couldn’t find your stationery. Please try again.'}</Text><TextAction label={refreshing ? 'Refreshing…' : 'Refresh stationery'} disabled={refreshing} onPress={onRetryCatalog} /></View>}
          <View role="radiogroup" accessibilityLabel="Letter stationery" style={styles.presetGrid}>
            {stylesToShow.map((preset, index) => <Pressable key={preset.id} role="radio" aria-checked={selected?.id === preset.id} accessibilityState={{ checked: selected?.id === preset.id }} accessibilityLabel={preset.displayName}
              {...(Platform.OS === 'web' ? { tabIndex: selected?.id === preset.id ? 0 as const : -1 as const, onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboardPreset(event, index) } : {})}
              onPress={() => controller.choosePreset(preset)} style={({ pressed }) => [styles.preset, width < 350 && { flexBasis: '100%' }, selected?.id === preset.id && styles.selectedPreset, pressed && { opacity: .75 }]}>
              <View style={[styles.presetInset, { pointerEvents: "none" }]} /><Text style={styles.presetNumber}>{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][index] ?? index+1}</Text><MiniStationery preset={preset} /><Text style={styles.presetName}>{preset.displayName}</Text>{preset.collection === 'royal' && <Text style={{ color: '#8C713E', fontSize: 8, lineHeight: 14, textAlign: 'center' }}>ROYAL · INCLUDED</Text>}<View style={[styles.presetDot, { backgroundColor: selected?.id === preset.id ? gold : 'transparent' }]} />
            </Pressable>)}
          </View>
          {selected && <Text style={styles.presetDescription}>{selected.description}</Text>}
          <View style={styles.sealSection}><View style={styles.quietIcon}><StoryIcon kind="letter" size={30} /></View><Text style={styles.sealTitle}>Ready to fold it away?</Text><Text style={[s.body, { textAlign: 'center', marginBottom: 18 }]}>Seal it when it feels right. You can always open it again.</Text><StoryButton label="Seal my letter" onPress={seal} disabled={!selected || Boolean(draftProblem(draft)) || !fullySaved || recordingBusy} /><Text style={styles.smallNote}>Your envelope stays here with you.</Text></View>
        </View>
      </View>
      {switchKind && <StoryDialog title={switchKind === 'VOICE' ? 'Start a voice letter?' : 'Start a written letter?'} onClose={() => setSwitchKind(null)}><Text style={s.body}>This replaces the current {draft.kind === 'VOICE' ? 'recording' : 'written page'} on this device. Your previous letter cannot be restored.</Text><StoryButton label={switchKind === 'VOICE' ? 'Use a voice letter' : 'Use a written letter'} onPress={() => { if (controller.changeKind(switchKind)) setSwitchKind(null); }} /><StoryButton label="Keep my current letter" secondary onPress={() => setSwitchKind(null)} /></StoryDialog>}
    </StoryShell>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  kindTabs: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 22 }, kindTab: { minHeight: 44, padding: 13, borderWidth: 1, borderColor: '#C4AD82', borderRadius: 4 }, kindSelected: { backgroundColor: '#E9DBBC', borderColor: '#96733F' }, kindText: { color: '#695132', fontFamily: serif, fontSize: 17 },
  masthead: { marginTop: 28, minHeight: 195, borderWidth: 1, borderColor: '#A98B57', borderRadius: 6, overflow: 'hidden', justifyContent: 'center' },
  mastheadWords: { padding: 28, maxWidth: 690, gap: 13 },
  mastheadEyebrow: { color: '#D6B77C', fontSize: 9, letterSpacing: 2.5 },
  mastheadTitle: { color: '#F4E6C7', fontFamily: serif, fontSize: 41, lineHeight: 50 },
  mastheadSubtitle: { color: '#DEC9A3', fontFamily: serif, fontSize: 15, lineHeight: 24, fontStyle: 'italic' },
  background: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  deskInset: { ...StyleSheet.absoluteFill, margin: 7, borderWidth: 1, borderColor: 'rgba(225,191,129,.4)', borderRadius: 4 },
  steps: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 11, marginVertical: 25, flexWrap: 'wrap' },
  step: { color: mutedInk, fontSize: 9, letterSpacing: 1.6 }, stepLine: { width: 32, height: 1, backgroundColor: line },
  layout: { gap: 25, padding: 18, borderWidth: 1, borderColor: '#A68B5A', borderRadius: 6, backgroundColor: '#60432E', overflow: 'hidden' }, letterSide: { minWidth: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  save: { color: '#516345', fontSize: 10, backgroundColor: '#EDDFC1', paddingVertical: 5, paddingHorizontal: 7, borderRadius: 2 },
  editor: { height: 420, fontSize: 19, lineHeight: 32, padding: 0, backgroundColor: 'transparent', borderWidth: 0 },
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 17, gap: 12, flexWrap: 'wrap' },
  counter: { color: '#E0CCA6', fontSize: 12 }, note: { color: mutedInk, fontSize: 11, lineHeight: 19 }, error: { color: '#923F35', fontSize: 13, lineHeight: 22 },
  saveError: { gap: 10, marginTop: 18, backgroundColor: '#F0E3C8', padding: 14, borderRadius: 3 },
  stationerySide: { borderWidth: 1, borderColor: '#AD9361', backgroundColor: '#EDE0C1', padding: 20, borderRadius: 4 },
  asideTitle: { fontFamily: serif, fontSize: 25, color: '#59422D', textAlign: 'center', marginTop: 12, marginBottom: 10 },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  preset: { flexGrow: 1, flexBasis: '45%', alignItems: 'center', padding: 13, paddingTop: 26, borderRadius: 3, borderWidth: 1, borderColor: '#C0AA7C', backgroundColor: '#F6EACF', gap: 10, overflow: 'hidden' },
  presetInset: { ...StyleSheet.absoluteFill, margin: 4, borderWidth: 1, borderColor: '#D9C7A0' },
  presetNumber: { position: 'absolute', top: 7, left: 10, color: '#907544', fontFamily: serif, fontSize: 10 },
  selectedPreset: { borderColor: '#8C6932', backgroundColor: '#DFCEA9', boxShadow: 'inset 0px 0px 6px rgba(101,68,26,.15)' },
  presetName: { fontFamily: serif, color: ink, fontSize: 12, textAlign: 'center', minHeight: 17 },
  presetDot: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: gold },
  presetDescription: { color: mutedInk, fontFamily: serif, fontStyle: 'italic', fontSize: 13, lineHeight: 21, textAlign: 'center', marginTop: 18, minHeight: 42 },
  sealSection: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: line }, quietIcon: { alignItems: 'center', marginBottom: 12 },
  sealTitle: { fontFamily: serif, color: ink, fontSize: 23, marginBottom: 10, textAlign: 'center' },
  smallNote: { textAlign: 'center', fontSize: 9, lineHeight: 17, color: mutedInk, marginTop: 12 },
  catalogNotice: { marginBottom: 16, alignItems: 'center' },
  emptyPaper: { minHeight: 420, padding: 24, borderWidth: 1, borderColor: line, justifyContent: 'center', alignItems: 'center', gap: 18 },
  emptyTitle: { fontFamily: serif, fontSize: 24, color: ink, textAlign: 'center' },
});
