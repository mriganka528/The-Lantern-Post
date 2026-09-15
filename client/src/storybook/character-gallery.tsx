import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import type { CharacterDetails } from '@lantern-post/shared-types';
import { CharacterArt } from './character-art';
import { Flourish, StoryIcon } from './ornaments';
import { PalaceScene } from './palace-scene';
import { StoryButton, StoryDialog, StoryHeading, StoryShell, TextAction, s } from './story-ui';
import { gold, ink, line, mutedInk, palettes, paper, serif } from './theme';

interface GalleryProps {
  characters: CharacterDetails[];
  currentId?: string | null;
  busy: boolean;
  error?: string | null;
  onChoose: (character: CharacterDetails) => void;
  onAccount: () => void;
  onBack?: () => void;
}

export function CharacterGallery({ characters, currentId, busy, error, onChoose, onAccount, onBack }: GalleryProps) {
  const { width } = useWindowDimensions();
  const wide = width >= 980;
  const [selectedId, setSelectedId] = useState(currentId ?? characters[0]?.id);
  const [confirming, setConfirming] = useState<CharacterDetails | null>(null);
  const committing = useRef(false);
  useEffect(() => { if (!busy) committing.current = false; }, [busy]);
  const selected = characters.find(character => character.id === selectedId) ?? characters[0];
  if (!selected) return null;
  const portraitSize = wide ? 121 : width < 420 ? 110 : 140;

  function keyboardSelect(event: KeyboardEvent<HTMLElement>, index: number) {
    if (busy) return;
    const direction = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0;
    let next = index;
    if (direction) next = (index + direction + characters.length) % characters.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = characters.length - 1;
    else if (![' ', 'Enter'].includes(event.key)) return;
    event.preventDefault();
    setSelectedId(characters[next]!.id);
    if ([' ', 'Enter'].includes(event.key)) setConfirming(characters[next]!);
    event.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  }

  function confirm() {
    if (!confirming || !characters.some(character => character.id === confirming.id) || busy || committing.current) return;
    committing.current = true;
    onChoose(confirming);
  }

  return <><StoryShell chapter="THE FIRST PAGE OF YOUR STORY" actions={<>{onBack && <TextAction label="My palace" onPress={onBack} disabled={busy} />}<TextAction label="Account" onPress={onAccount} disabled={busy} /></>}>
    <StoryHeading eyebrow="CHAPTER I · A KINDRED SPIRIT" title="Every story begins with a companion." subtitle="Kindred souls and extraordinary palaces. Choose the one that feels a little like you — every companion is included." />
    <View style={[styles.layout, wide && styles.wideLayout]}>
      <View style={[styles.gallerySide, wide && { flex: 1.45 }]}>
        <View style={styles.sectionHeader}><Text style={styles.sectionLabel}>MEET THE COMPANIONS</Text><Text style={styles.sectionMeta}>A little kinship goes a long way</Text></View>
        <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Choose your companion">
          {characters.map((character, index) => {
            const chosen = character.id === selected.id;
            return <Pressable key={character.id} accessibilityRole="radio" accessibilityLabel={`${character.displayName}, ${character.title}. ${character.palace.name}`} accessibilityState={{ checked: chosen, disabled: busy }} aria-checked={chosen} aria-disabled={busy}
              {...(Platform.OS === 'web' ? { tabIndex: chosen ? 0 as const : -1 as const, onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboardSelect(event, index) } : {})}
              disabled={busy} onPress={() => { setSelectedId(character.id); setConfirming(character); }} style={({ pressed }) => [styles.card, { width: width < 600 ? '48%' : '31.7%' }, chosen && styles.chosenCard, pressed && { opacity: .8 }]}>
              <View style={styles.cardTop}><Text style={styles.number}>{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][index] ?? index + 1}</Text><View style={[styles.radio, chosen && { backgroundColor: gold, borderColor: gold }]}>{chosen && <Text style={styles.tick}>✓</Text>}</View></View>
              <View style={[styles.portrait, { backgroundColor: palettes[character.key].mist, width: portraitSize + 10, height: portraitSize * 1.15 + 10 }]}>
                <View style={styles.portraitRing} /><CharacterArt characterKey={character.key} size={portraitSize} />
              </View>
              <Text style={styles.name}>{character.displayName}</Text>
              {character.collection === 'royal' && <Text style={styles.royal}>ROYAL COLLECTION · INCLUDED</Text>}
              <Text style={styles.role}>{character.title.replace('The ', '')}</Text>
              <View style={styles.cardDash} />
              <Text style={styles.palaceLabel}>{character.palace.name.replace('The ', '')}</Text>
            </Pressable>;
          })}
        </View>
        <Text style={styles.reassurance}>Follow your heart. You can choose another companion any time.</Text>
      </View>
      <View style={[styles.preview, wide && { flex: .9 }]}>
        <View style={styles.previewInner}>
          <Text style={s.eyebrow}>YOUR NEXT LITTLE CHAPTER</Text>
          <View style={styles.selectedTitle}><Text style={styles.previewTitle}>{selected.displayName}</Text><StoryIcon kind="star" size={21} /></View>
          <Text style={styles.previewRole}>{selected.title}</Text>
          <Text style={[s.body, { textAlign: 'center', marginTop: 14 }]}>{selected.description}</Text>
          <View style={styles.flourish}><Flourish width={140} /></View>
          <PalaceScene characterKey={selected.key} compact />
          <Text style={styles.palaceName}>{selected.palace.name}</Text>
          <Text style={[s.body, { textAlign: 'center', fontSize: 12, marginBottom: 22 }]}>{selected.palace.description}</Text>
          {Boolean(error) && !confirming && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
          <StoryButton label={busy ? 'Preparing your palace…' : currentId === selected.id ? 'Return to my palace' : `Begin with ${selected.displayName}`} onPress={() => setConfirming(selected)} busy={busy} />
          <Text style={styles.smallPrint}>A companion. A palace. A place to begin.</Text>
        </View>
      </View>
    </View>
  </StoryShell>
  {confirming && <StoryDialog title={`Go with ${confirming.displayName}?`} onClose={() => { if (!busy) setConfirming(null); }} footer={<>
    <StoryButton label={busy ? 'Preparing your palace…' : `Go with ${confirming.displayName}`} onPress={confirm} busy={busy} disabled={!characters.some(character => character.id === confirming.id)} />
    <StoryButton label="Select another companion" secondary onPress={() => setConfirming(null)} disabled={busy} />
  </>}>
    <View style={styles.choiceSummary}><CharacterArt characterKey={confirming.key} size={64} /><View style={{ flex: 1, gap: 5 }}><Text style={styles.choicePalace}>{confirming.palace.name}</Text><Text style={s.body}>{confirming.title}</Text></View></View>
    <Text style={s.body}>{confirming.description} You can choose another companion later.</Text>
    {!characters.some(character => character.id === confirming.id) && <Text role="alert" style={styles.error}>This companion is no longer available. Please select another companion.</Text>}
    {Boolean(error) && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}>{error}</Text>}
  </StoryDialog>}
  </>;
}

const styles = StyleSheet.create({
  layout: { gap: 30 },
  choiceSummary: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  choicePalace: { fontFamily: serif, fontSize: 21, lineHeight: 27, color: ink },
  wideLayout: { flexDirection: 'row', gap: 36, alignItems: 'flex-start' },
  gallerySide: { minWidth: 0 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 18, flexWrap: 'wrap' },
  sectionLabel: { color: mutedInk, fontSize: 9, letterSpacing: 1.9 },
  sectionMeta: { color: mutedInk, fontFamily: serif, fontSize: 12, fontStyle: 'italic' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  card: { borderWidth: 1, borderColor: line, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 17, alignItems: 'center', backgroundColor: '#FCF9F1', borderRadius: 5 },
  chosenCard: { borderColor: gold, backgroundColor: '#F1E9D7', boxShadow: '0px 3px 12px rgba(92,70,33,0.07)' },
  cardTop: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', height: 18 },
  number: { fontFamily: serif, color: '#8F8065', fontSize: 11 },
  radio: { borderColor: '#C7BA9C', borderWidth: 1, width: 17, height: 17, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  tick: { color: paper, fontSize: 11, lineHeight: 14 },
  portrait: { alignItems: 'center', justifyContent: 'flex-end', borderTopLeftRadius: 90, borderTopRightRadius: 90, borderBottomLeftRadius: 45, borderBottomRightRadius: 45, marginTop: 3, marginBottom: 13, maxWidth: '100%' },
  portraitRing: { ...StyleSheet.absoluteFill, margin: 4, borderTopLeftRadius: 90, borderTopRightRadius: 90, borderBottomLeftRadius: 45, borderBottomRightRadius: 45, borderWidth: 1, borderColor: 'rgba(163,132,73,.16)' },
  name: { fontFamily: serif, fontSize: 24, color: ink },
  royal: { fontSize: 8, lineHeight: 15, letterSpacing: .6, color: '#95743B', textAlign: 'center', marginTop: 7 },
  role: { fontSize: 9, color: mutedInk, textAlign: 'center', marginTop: 7, lineHeight: 15, minHeight: 30 },
  cardDash: { width: 22, height: 1, backgroundColor: line, marginVertical: 8 },
  palaceLabel: { fontFamily: serif, fontStyle: 'italic', fontSize: 11, color: '#7A6A51', textAlign: 'center' },
  reassurance: { fontFamily: serif, color: mutedInk, fontStyle: 'italic', textAlign: 'center', fontSize: 13, lineHeight: 21, marginTop: 18 },
  preview: { borderWidth: 1, borderColor: '#C7B793', backgroundColor: '#F2ECDD', padding: 7, borderTopLeftRadius: 100, borderTopRightRadius: 100 },
  previewInner: { borderWidth: 1, borderColor: '#DDCFB4', borderTopLeftRadius: 93, borderTopRightRadius: 93, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  selectedTitle: { flexDirection: 'row', gap: 12, justifyContent: 'center', alignItems: 'center', marginTop: 13 },
  previewTitle: { fontFamily: serif, fontSize: 42, color: ink },
  previewRole: { fontFamily: serif, fontStyle: 'italic', fontSize: 15, color: '#7A6A51', textAlign: 'center', marginTop: 8 },
  flourish: { alignItems: 'center', marginVertical: 16 },
  palaceName: { fontFamily: serif, color: ink, fontSize: 21, textAlign: 'center', marginTop: 19, marginBottom: 9 },
  smallPrint: { fontSize: 9, lineHeight: 16, color: mutedInk, textAlign: 'center', marginTop: 13 },
  error: { color: '#963E2C', fontSize: 13, lineHeight: 20, marginBottom: 14 },
});
