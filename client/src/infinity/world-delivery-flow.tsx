import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { CharacterKey } from '@lantern-post/shared-types';
import type { DraftController, LetterDraft } from '../letters/draft';
import { EnvelopeArt } from '../letters/envelope-art';
import { StoryButton, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import type { WorldDeliveryTransport } from './world-controller';
import { InfinityJourney } from './infinity-journey';
export function WorldDeliveryFlow({ draft, controller, api, courier, saved, busy, error, onConfirm, onKeep, onRetry, onCheck, onCancel, onCleanup, onBack, onExplore, onWrite }: {
  draft: LetterDraft; controller: DraftController; api: WorldDeliveryTransport; courier?: CharacterKey; saved: boolean; busy: boolean; error: string | null;
  onConfirm: () => void; onKeep: () => void; onRetry: () => void; onCheck: () => void; onCancel: () => void; onCleanup: () => void; onBack: () => void; onExplore: () => void; onWrite: () => void;
}) {
  const [preview, setPreview] = useState(false); const [alreadyPublished] = useState(draft.stage === 'published');
  const capabilities = useQuery({ queryKey: ['world-capabilities', draft.ownerId], queryFn: ({ signal }) => api.capabilities(signal), staleTime: 0, enabled: draft.stage === 'sealed' });
  if (draft.preset && ((draft.stage === 'published' && saved) || (preview && draft.stage === 'sealed'))) return <InfinityJourney preset={draft.preset} courier={courier} preview={preview && draft.stage === 'sealed'} alreadyDelivered={alreadyPublished} onBack={preview ? () => setPreview(false) : onBack} onExplore={onExplore} onWrite={onWrite} />;
  if (draft.stage !== 'sealed') return <StoryShell chapter="A LETTER ON ITS WAY TO THE SKY" actions={<TextAction label="My palace" onPress={onBack} disabled={draft.stage === 'published' && !saved} />}>
    <StoryHeading eyebrow="HELD SAFELY ALONG THE WAY" title={draft.stage === 'published' ? 'One last little step…' : 'Waiting for the sky to reply.'} subtitle={draft.stage === 'published' ? 'Your letter has been shared. This device still needs to finish clearing its local copy.' : 'Your letter stays sealed while its outcome is uncertain. We’ll recheck this confirmed letter while the desk is open. You can also check, retry or cancel.'} />
    <View style={styles.panel}>{busy && <ActivityIndicator color="#9C8050" />}{error && <Text role="alert" style={s.body}>{error}</Text>}{draft.stage === 'published' ? <StoryButton label="Finish clearing this shared letter" onPress={onCleanup} /> : <><StoryButton label="Retry public sharing" busy={busy} onPress={onRetry} /><TextAction label="Check public sharing status" disabled={busy} onPress={onCheck} /><TextAction label="Cancel sharing and keep my letter" disabled={busy} onPress={onCancel} /></>}</View>
  </StoryShell>;
  const available = draft.kind === 'VOICE' ? capabilities.data?.voiceAvailable && (!draft.voiceCaption || capabilities.data?.textAvailable) : capabilities.data?.textAvailable;
  return <StoryShell chapter="A LETTER FOR THE INFINITY WORLD" actions={<TextAction label="My sealed letter" onPress={onKeep} />}>
    <StoryHeading eyebrow="BEFORE IT BECOMES A STAR" title="A little light, shared with everyone." subtitle="Anyone visiting the Infinity World can open this letter. Choose whether your username travels with it." />
    <View style={styles.panel}>{draft.preset && <View style={{ alignSelf: 'center' }}><EnvelopeArt preset={draft.preset} width={230} /></View>}
      <Pressable accessibilityRole="checkbox" accessibilityLabel="Sign it with my username" accessibilityState={{ checked: draft.worldSigned }} aria-checked={draft.worldSigned} onPress={() => controller.chooseWorldSignature(!draft.worldSigned)} style={styles.sign}><Text style={s.body}>{draft.worldSigned ? '☑' : '☐'}  Sign it with my username</Text></Pressable>
      <Text style={s.body}>{draft.worldSigned ? 'Your username will appear when someone opens your letter.' : 'Your username will stay hidden. The words or voice you share can still identify you.'}</Text>
      {!available && <Text style={s.body}>Public sharing is resting for now. You can preview the journey while your letter stays safely here.</Text>}
      {(error || !saved) && <Text role="alert" style={s.body}>{error ?? 'Save your letter before sharing.'}</Text>}
      <StoryButton label="Share my letter publicly" onPress={onConfirm} disabled={!saved || !available || capabilities.isError} busy={busy} />
      <StoryButton label="Preview the Infinity journey" secondary onPress={() => setPreview(true)} disabled={busy} />
      <TextAction label="Keep my sealed letter" onPress={onKeep} />
      {capabilities.isError && <TextAction label="Check public sharing availability" onPress={() => { void capabilities.refetch(); }} />}
    </View>
  </StoryShell>;
}
const styles = StyleSheet.create({ panel: { width: '100%', maxWidth: 520, alignSelf: 'center', gap: 22, padding: 25, backgroundColor: '#F2E7CD', borderWidth: 1, borderColor: '#C5AE80', borderRadius: 6 }, sign: { borderWidth: 1, borderColor: '#B8A47D', backgroundColor: '#F9F2DF', padding: 14, minHeight: 48 } });
