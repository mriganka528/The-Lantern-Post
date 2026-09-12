import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { CharacterKey, FriendPerson, LetterRecipient } from '@lantern-post/shared-types';
import { StoryButton, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { CharacterArt } from '../storybook/character-art';
import { StoryIcon } from '../storybook/ornaments';
import { ink, mutedInk, serif } from '../storybook/theme';
import { useFriendsList } from '../friends/use-friends-data';
import type { FriendsTransport } from '../friends/friends-api';
import type { LetterDraft } from './draft';
import type { DeliveryTransport } from './delivery-controller';
import { DeliveryJourney } from './delivery-journey';
import { EnvelopeArt } from './envelope-art';

const target = (person: FriendPerson): LetterRecipient => ({ id: person.id, username: person.username, characterKey: person.character?.key ?? null, palaceName: person.character?.palace.name ?? 'your friend’s palace' });
export function FriendDeliveryFlow({ draft, saved, busy, error, api, friends, courier, initialRecipientId, onConfirm, onKeep, onRetry, onCheck, onCancel, onCleanup, onBack, onFinish, onFriends }: {
  draft: LetterDraft; saved: boolean; busy: boolean; error: string | null; api: DeliveryTransport; friends: FriendsTransport; courier?: CharacterKey; initialRecipientId?: string;
  onConfirm: (recipient: LetterRecipient) => void; onKeep: () => void; onRetry: () => void; onCheck: () => void; onCancel: () => void; onCleanup: () => void; onBack: () => void; onFinish: () => void; onFriends?: () => void;
}) {
  const [wasDelivered] = useState(draft.stage === 'delivered');
  if (draft.stage === 'delivered' && saved && draft.deliveryRecipient && draft.preset) return <DeliveryJourney recipient={draft.deliveryRecipient} preset={draft.preset} courier={courier} alreadyDelivered={wasDelivered} onFinish={onFinish} />;
  if (draft.stage === 'sealed' && draft.preset) return <DestinationPicker ownerId={draft.ownerId} draft={draft} saved={saved} busy={busy} error={error} api={api} friends={friends} courier={courier} initialRecipientId={initialRecipientId} onConfirm={onConfirm} onKeep={onKeep} onFriends={onFriends} />;
  return <StoryShell chapter="THE PRIVATE PALACE POST" actions={<TextAction label="My palace" onPress={onBack} disabled={draft.stage === 'delivered' && !saved} />}>
    <StoryHeading eyebrow="HELD SAFELY ALONG THE WAY" title={draft.stage === 'delivered' ? 'One last little step…' : 'Waiting for the palace post…'} subtitle={draft.stage === 'delivered' ? 'Your letter has arrived. This device still needs to finish saving the delivery result.' : 'Your letter stays sealed while we check its delivery. Its destination cannot change while the reply is uncertain.'} />
    <View style={styles.pending}>{draft.preset && <EnvelopeArt preset={draft.preset} width={230} />}{draft.deliveryRecipient && <Text style={styles.target}>For @{draft.deliveryRecipient.username}</Text>}
      {busy && <ActivityIndicator color="#997B44" />}{error && <Text role="alert" style={styles.error}>{error}</Text>}
      {draft.stage === 'delivered' ? <StoryButton label="Finish saving this delivery" onPress={onCleanup} /> : <>
        <StoryButton label={busy ? 'Checking the reply…' : 'Retry this delivery'} busy={busy} onPress={onRetry} />
        <TextAction label="Check delivery status" onPress={onCheck} disabled={busy} /><TextAction label="Cancel delivery and keep my letter" onPress={onCancel} disabled={busy} />
      </>}
    </View>
  </StoryShell>;
}
function DestinationPicker({ ownerId, draft, saved, busy, error, api, friends, courier, initialRecipientId, onConfirm, onKeep, onFriends }: {
  ownerId: string; draft: LetterDraft; saved: boolean; busy: boolean; error: string | null; api: DeliveryTransport; friends: FriendsTransport; courier?: CharacterKey; initialRecipientId?: string; onConfirm: (recipient: LetterRecipient) => void; onKeep: () => void; onFriends?: () => void;
}) {
  const list = useFriendsList(friends, ownerId, 'friends');
  const capabilities = useQuery({ queryKey: ['delivery-capabilities', ownerId], queryFn: ({ signal }) => api.capabilities(signal), staleTime: 0 });
  const [selectedId, setSelectedId] = useState(initialRecipientId ?? ''); const [preview, setPreview] = useState(false);
  const people = list.data?.pages.flatMap(page => page.items.map(item => item.person)) ?? [];
  const selected = people.find(person => person.id === selectedId);
  if (preview && selected && draft.preset) return <DeliveryJourney preview recipient={target(selected)} preset={draft.preset} courier={courier} onFinish={() => setPreview(false)} />;
  return <StoryShell chapter="CHOOSE A FRIENDSHIP GATE" actions={<TextAction label="My sealed letter" onPress={onKeep} />}>
    <StoryHeading eyebrow="A PRIVATE PATH BETWEEN PALACES" title="Whose gate is this letter for?" subtitle="Choose one friend. Your name travels with this letter, and its words stay between your two palaces." />
    {list.isPending ? <View style={styles.pending}><ActivityIndicator color="#997B44" /><Text style={s.body}>Finding the gates in your circle…</Text></View> : list.isError ? <View style={styles.pending}><Text role="alert" style={styles.error}>Your friendship gates could not be found.</Text><TextAction label="Refresh friendship gates" onPress={() => { void list.refetch(); }} /></View> : !people.length ? <View style={styles.pending}><StoryIcon kind="gate" size={42} /><Text style={styles.target}>A friendship opens the way.</Text><Text style={s.body}>Invite a friend to your circle before sending a private letter.</Text>{onFriends && <StoryButton label="Visit the friendship court" onPress={onFriends} />}<TextAction label="Keep my sealed letter" onPress={onKeep} /></View> : <>
      <View role="radiogroup" accessibilityLabel="Friendship destination" style={styles.choices}>{people.map(person => <Pressable key={person.id} role="radio" accessibilityLabel={`Send to ${person.username}`} accessibilityState={{ checked: selectedId === person.id }} aria-checked={selectedId === person.id} onPress={() => setSelectedId(person.id)} style={[styles.choice, selectedId === person.id && styles.chosen]}>
        {person.character ? <CharacterArt characterKey={person.character.key} size={77} /> : <StoryIcon kind="gate" size={45} />}<View style={{ flex: 1, gap: 7 }}><Text style={styles.target}>@{person.username}</Text><Text style={styles.small}>{person.character?.palace.name ?? 'A little palace beyond the clouds'}</Text></View><StoryIcon kind="key" size={22} />
      </Pressable>)}</View>
      {list.hasNextPage && <TextAction label={list.isFetchingNextPage ? 'Finding more gates…' : 'More friendship gates'} onPress={() => { void list.fetchNextPage(); }} disabled={list.isFetchingNextPage} />}
      {initialRecipientId && !selected && !list.hasNextPage && <Text style={styles.small}>That gate is no longer in this list. Choose another friend, or keep your letter.</Text>}
      <View style={styles.confirmation}>
        {selected ? <><Text style={styles.target}>For @{selected.username}</Text><Text style={s.body}>Only you and this friend can open the letter while your friendship is active. Send it when you are ready.</Text></> : <Text style={s.body}>Choose a gate above to address your envelope.</Text>}
        {error && <Text role="alert" style={styles.error}>{error}</Text>}
        {!capabilities.data?.moderationAvailable && <View style={{ gap: 8 }}><Text style={styles.small}>Delivery is resting for now. You can preview the journey; your letter will stay here with you.</Text>{capabilities.isError && <TextAction label="Check the palace post again" onPress={() => { void capabilities.refetch(); }} />}</View>}
        <StoryButton label={selected ? `Send my letter to ${selected.username}` : 'Choose a friendship gate'} onPress={() => { if (selected) onConfirm(target(selected)); }} disabled={!selected || !saved || busy || !capabilities.data?.moderationAvailable} />
        <StoryButton label="Preview the journey" onPress={() => setPreview(true)} disabled={!selected} secondary />
        <TextAction label="Keep my sealed letter" onPress={onKeep} />
      </View>
    </>}
  </StoryShell>;
}
const styles = StyleSheet.create({
  pending: { maxWidth: 570, alignSelf: 'center', alignItems: 'center', gap: 21, paddingVertical: 26, width: '100%' }, target: { color: ink, fontFamily: serif, fontSize: 23 }, small: { color: mutedInk, fontSize: 12, lineHeight: 22 }, error: { color: '#874E37', fontSize: 13, lineHeight: 23, textAlign: 'center' },
  choices: { gap: 13, maxWidth: 760, width: '100%', alignSelf: 'center' }, choice: { minHeight: 108, borderWidth: 1, borderColor: '#CAB48C', borderRadius: 5, backgroundColor: '#F6ECD6', padding: 17, flexDirection: 'row', alignItems: 'center', gap: 19 }, chosen: { borderColor: '#95713C', backgroundColor: '#E9DABC' }, confirmation: { maxWidth: 540, width: '100%', alignSelf: 'center', gap: 16, padding: 24, marginTop: 30, borderWidth: 1, borderColor: '#BAA275', backgroundColor: '#EFE4CB', borderRadius: 4 },
});
