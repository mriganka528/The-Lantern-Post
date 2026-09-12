import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { KeyboardEvent } from 'react';
import { Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import type { CharacterKey, LetterPreset } from '@lantern-post/shared-types';
import { ActionButton, AuthPage, LoadingScreen } from '../components/auth-ui';
import { Flourish, StoryIcon } from '../storybook/ornaments';
import { StoryButton, StoryDialog, StoryShell, TextAction, s } from '../storybook/story-ui';
import { gold, ink, line, mutedInk, serif } from '../storybook/theme';
import { characterCount, LETTER_LIMIT, letterProblem } from './draft';
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

export function WritingDesk({ ownerId, presets, catalogUnavailable = false, refreshing = false, onRetryCatalog, onBack, burnTransport, deliveryTransport, friendsTransport, characterKey, initialRecipientId, onFriends }: {
  ownerId: string; presets: LetterPreset[]; catalogUnavailable?: boolean; refreshing?: boolean; onRetryCatalog: () => void; onBack: () => void; burnTransport?: BurnTransport;
  deliveryTransport?: DeliveryTransport; friendsTransport?: FriendsTransport; characterKey?: CharacterKey; initialRecipientId?: string; onFriends?: () => void;
}) {
  const { controller, phase, draft, save, notice } = useLetterDraft(ownerId);
  const { width } = useWindowDimensions();
  const [animateSeal, setAnimateSeal] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [showBurn, setShowBurn] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [courier] = useState(() => new DeliveryController(controller, deliveryTransport ?? {
    submit: async () => { throw new Error('Delivery unavailable'); }, lookup: async () => { throw new Error('Delivery unavailable'); }, cancel: async () => { throw new Error('Delivery unavailable'); }, capabilities: async () => ({ moderationAvailable: false }),
  }, randomUUID));
  const delivery = useSyncExternalStore(courier.subscribe, courier.getSnapshot, courier.getSnapshot);
  const [burner] = useState(() => new BurnController(controller, burnTransport ?? {
    submit: async () => { throw new Error('Release service unavailable'); },
    lookup: async () => { throw new Error('Release service unavailable'); },
  }, randomUUID));
  const burn = useSyncExternalStore(burner.subscribe, burner.getSnapshot, burner.getSnapshot);
  const finishSeal = useCallback(() => setAnimateSeal(false), []);
  const finishBurn = useCallback(() => {
    if (controller.getSnapshot().draft?.stage === 'burned' && controller.getSnapshot().save === 'saved' && controller.reset()) onBack();
  }, [controller, onBack]);
  useEffect(() => {
    if (phase === 'ready' && draft?.stage === 'burn-pending') void burner.check();
  }, [burner, draft?.burnRequestId, draft?.stage, phase]);
  useEffect(() => { if (phase === 'ready' && draft?.stage === 'delivery-pending') void courier.check(); }, [courier, draft?.deliveryRequestId, draft?.stage, phase]);
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
  function goBack() { if (save !== 'error' || controller.retrySave()) onBack(); }
  if ((draft.stage === 'delivery-pending' || draft.stage === 'delivered') && (!deliveryTransport || !friendsTransport)) return <AuthPage title="Your letter is held safely" subtitle="The delivery service is unavailable in this view. Return to your palace and open the writing desk again to check its reply."><ActionButton label="My palace" onPress={onBack} /></AuthPage>;
  if (deliveryTransport && friendsTransport && (draft.stage === 'delivery-pending' || draft.stage === 'delivered' || (showFriends && draft.stage === 'sealed' && delivery.outcome !== 'REJECTED'))) {
    return <FriendDeliveryFlow key={draft.generationId} draft={draft} saved={save === 'saved'} busy={delivery.busy} error={delivery.error} api={deliveryTransport} friends={friendsTransport} courier={characterKey} initialRecipientId={initialRecipientId}
      onConfirm={recipient => { void courier.confirm(recipient); }} onKeep={() => setShowFriends(false)} onRetry={() => { void courier.retry(); }} onCheck={() => { void courier.check(); }} onCancel={() => { void courier.cancel(); }} onCleanup={() => courier.retryCleanup()} onBack={goBack} onFriends={onFriends}
      onFinish={() => { if (controller.getSnapshot().draft?.stage === 'delivered' && controller.getSnapshot().save === 'saved' && controller.reset()) onBack(); }} />;
  }
  if (draft.stage === 'burn-pending' || draft.stage === 'burned' || (showBurn && draft.stage === 'sealed' && burn.outcome !== 'REJECTED')) {
    return <BurningWorld key={draft.generationId} stage={draft.stage === 'sealed' ? 'confirm' : draft.stage === 'burn-pending' ? 'pending' : 'burned'} preset={selected} busy={burn.busy} saved={save === 'saved'} error={burn.error}
      onConfirm={() => { void burner.confirm(); }} onKeep={() => setShowBurn(false)} onRetry={() => { void burner.retry(); }} onCheck={() => { void burner.check(); }}
      onCleanup={() => burner.retryCleanup()} onBack={goBack} onFinish={finishBurn} />;
  }
  if (draft.stage === 'sealed' && selected) return <SealedEnvelope preset={selected} animate={animateSeal} onFinished={finishSeal} onUnseal={() => { setShowBurn(false); setShowFriends(false); controller.unseal(); if (burn.outcome === 'REJECTED' || delivery.outcome === 'REJECTED') onRetryCatalog(); }} onBack={goBack}
    onSend={burnTransport ? () => { burner.clearNotice(); setShowFriends(false); setShowBurn(true); } : undefined} onFriend={deliveryTransport && friendsTransport ? () => { courier.clearNotice(); setShowBurn(false); setShowFriends(true); } : undefined} notice={notice ?? delivery.error ?? burn.error ?? undefined} saveError={save === 'error'} onRetrySave={() => controller.retrySave()} />;
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
    if (controller.seal()) setAnimateSeal(true);
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <StoryShell chapter="AT THE WRITING DESK" actions={<TextAction label="My palace" onPress={goBack} />}>
      <View style={styles.masthead}>
        <Image source={require('../../assets/storybook/writing-chamber.png')} style={styles.background} resizeMode="cover" accessible={false} />
        <View style={styles.mastheadWords}><Text style={styles.mastheadEyebrow}>THE PALACE SCRIPTORIUM</Text><Text role="heading" style={[styles.mastheadTitle, width < 600 && { fontSize: 32, lineHeight: 42 }]}>A letter, by candlelight.</Text><Text style={styles.mastheadSubtitle}>Settle into the quiet. There is room for every word.</Text></View>
      </View>
      <View style={styles.steps}><Text style={styles.step}>I. THE PAGE</Text><View style={styles.stepLine} /><Text style={styles.step}>II. THE FINERY</Text><View style={styles.stepLine} /><Text style={styles.step}>III. THE SEAL</Text></View>
      <View style={[styles.layout, width >= 950 && { flexDirection: 'row', alignItems: 'flex-start' }]}>
        <Image source={require('../../assets/storybook/desk-wood.png')} style={styles.background} resizeMode="stretch" accessible={false} />
        <View pointerEvents="none" style={styles.deskInset} />
        <View style={[styles.letterSide, width >= 950 && { flex: 1.7 }]}>
          <View style={styles.sectionHeader}><Text style={[s.eyebrow, { color: '#E0C593' }]}>YOUR PRIVATE CORRESPONDENCE</Text><Text style={[styles.save, save === 'error' && styles.error]} accessibilityLiveRegion="polite">{save === 'error' ? 'Not saved yet' : 'Saved on this device'}</Text></View>
          {selected ? <PaperFrame preset={selected}>
            <TextInput accessibilityLabel="Your letter" multiline value={draft.text} onChangeText={text => controller.edit(text)}
              placeholder={'Dear whoever needs these words,\n\nThere is something on my mind…'} placeholderTextColor={`${selected.config.inkColor}80`}
              style={[styles.editor, width < 600 && { height: 320, fontSize: 17 }, stationeryFont(selected.config), { color: selected.config.inkColor, outlineColor: selected.config.ribbonColor }]}
              maxLength={20_000} textAlignVertical="top" autoCapitalize="sentences" autoCorrect scrollEnabled />
          </PaperFrame> : <View style={styles.emptyPaper}><Flourish /><Text style={styles.emptyTitle}>Finding a beautiful page…</Text><Text style={s.body}>Your stationery is taking a moment to arrive.</Text><StoryButton label={refreshing ? 'Looking for stationery…' : 'Try again'} busy={refreshing} onPress={onRetryCatalog} secondary /></View>}
          <View style={styles.counterRow}><Text style={[styles.note, { color: '#E0CCA6' }]}>Kept here until you choose to release it</Text><Text testID="letter-counter" style={[styles.counter, over && { color: '#FFD1B5' }]}>{count.toLocaleString()} / {LETTER_LIMIT.toLocaleString()}</Text></View>
          {over && <Text role="alert" style={[styles.error, { color: '#FFD1B5' }]}>{letterProblem(draft.text)}</Text>}
          {notice && <Text role="alert" style={{ color: '#EAD8B9', fontSize: 12, lineHeight: 20 }}>{notice}</Text>}
          {save === 'error' && <View style={styles.saveError}><Text role="alert" style={styles.error}>We couldn’t save your latest changes. Keep this page open and try again.</Text><StoryButton label="Retry saving" onPress={() => controller.retrySave()} secondary /></View>}
        </View>
        <View style={[styles.stationerySide, width >= 950 && { flex: 1 }]}>
          <Text style={s.eyebrow}>FROM THE ROYAL COLLECTION</Text><Text style={styles.asideTitle}>The stationery cabinet.</Text><Text style={[s.body, { textAlign: 'center', marginBottom: 20, fontSize: 12 }]}>Aged paper. Fine ribbon. A seal of your own.</Text>
          {catalogUnavailable && <View style={styles.catalogNotice}><Text style={styles.note}>{selected ? 'You can keep writing with your saved stationery while the others are unavailable.' : 'We couldn’t find your stationery. Please try again.'}</Text><TextAction label={refreshing ? 'Refreshing…' : 'Refresh stationery'} disabled={refreshing} onPress={onRetryCatalog} /></View>}
          <View role="radiogroup" accessibilityLabel="Letter stationery" style={styles.presetGrid}>
            {stylesToShow.map((preset, index) => <Pressable key={preset.id} role="radio" aria-checked={selected?.id === preset.id} accessibilityState={{ checked: selected?.id === preset.id }} accessibilityLabel={preset.displayName}
              {...(Platform.OS === 'web' ? { tabIndex: selected?.id === preset.id ? 0 as const : -1 as const, onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboardPreset(event, index) } : {})}
              onPress={() => controller.choosePreset(preset)} style={({ pressed }) => [styles.preset, width < 350 && { flexBasis: '100%' }, selected?.id === preset.id && styles.selectedPreset, pressed && { opacity: .75 }]}>
              <View pointerEvents="none" style={styles.presetInset} /><Text style={styles.presetNumber}>{['I', 'II', 'III', 'IV', 'V', 'VI'][index]}</Text><MiniStationery preset={preset} /><Text style={styles.presetName}>{preset.displayName}</Text><View style={[styles.presetDot, { backgroundColor: selected?.id === preset.id ? gold : 'transparent' }]} />
            </Pressable>)}
          </View>
          {selected && <Text style={styles.presetDescription}>{selected.description}</Text>}
          <View style={styles.sealSection}><View style={styles.quietIcon}><StoryIcon kind="letter" size={30} /></View><Text style={styles.sealTitle}>Ready to fold it away?</Text><Text style={[s.body, { textAlign: 'center', marginBottom: 18 }]}>Seal it when it feels right. You can always open it again.</Text><StoryButton label="Seal my letter" onPress={seal} disabled={!selected || Boolean(letterProblem(draft.text)) || save === 'error'} /><Text style={styles.smallNote}>Your envelope stays here with you.</Text></View>
        </View>
      </View>
    </StoryShell>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
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
