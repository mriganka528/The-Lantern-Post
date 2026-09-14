import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { DraftController } from './draft';
import { draftStorage } from './draft-storage';
import { LetterLibrary, LetterRemovalError, letterDocumentId, letterStageLabel } from './letter-library';
import type { LetterEntry, RemovalTicket } from './letter-library';
import { StoryButton, StoryDialog, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { LoadingScreen } from '../components/auth-ui';
import { serif } from '../storybook/theme';
import { StoryIcon, Flourish } from '../storybook/ornaments';
import { RoyalNavButton, RoyalWorkspaceBar, WorkspaceNavigation } from '../storybook/royal-navigation';
import { useCabinetCleanup } from './use-cabinet-cleanup';

type Props = { ownerId: string; onBack: () => void; children: (controller: DraftController, onNew: () => void, onBusy: (busy: boolean) => void) => ReactNode };
export function LetterWorkspace(props: Props) { return <OwnerWorkspace key={props.ownerId} {...props} />; }
function OwnerWorkspace({ ownerId, children, onBack }: Props) {
  const [library] = useState(() => new LetterLibrary(ownerId, draftStorage, randomUUID));
  const [controller, setController] = useState<DraftController | null>(null);
  const [error, setError] = useState(false);
  const open = useCallback((id: string) => { library.remember(id); const next = new DraftController(ownerId, draftStorage, randomUUID, letterDocumentId(id)); setController(current => current?.key === next.key ? current : next); }, [library, ownerId]);
  const restore = useCallback(() => { try { open(library.open()); setError(false); } catch { setError(true); } }, [library, open]);
  useEffect(() => { let active = true; void Promise.resolve().then(() => { if (active) restore(); }); return () => { active = false; }; }, [restore]);
  if (!controller) return error ? <View style={styles.restore}><Text style={s.body}>Your letter cabinet could not be opened. Your saved pages have been kept.</Text><StoryButton label="Restore my letters" onPress={restore} /><StoryButton label="My palace" onPress={onBack} secondary /></View> : <LoadingScreen />;
  return <ReadyWorkspace controller={controller} library={library} open={open} onBack={onBack}>{children}</ReadyWorkspace>;
}
function ReadyWorkspace({ controller, library, open, children, onBack }: Omit<Props, 'ownerId'> & { controller: DraftController; library: LetterLibrary; open: (id: string) => void }) {
  useCabinetCleanup(library.ownerId, controller.key);
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const { width } = useWindowDimensions(); const narrow = width < 760;
  const [cabinet, setCabinet] = useState(false); const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<LetterEntry[]>([]); const [shown, setShown] = useState(12); const [error, setError] = useState<string | null>(null);
  const [removal, setRemoval] = useState<{ ticket: RemovalTicket; title: string } | null>(null);
  const [cleanupCount, setCleanupCount] = useState(0);
  const refreshCabinet = useCallback(() => { setEntries(library.entries()); setCleanupCount(library.pendingRemovals()); }, [library]);
  useEffect(() => {
    if (!cabinet) return;
    return draftStorage.watch?.(() => { try { refreshCabinet(); } catch { setError('The cabinet could not be refreshed. Please try again.'); } });
  }, [cabinet, refreshCabinet]);
  function canLeave() {
    if (busy) { setError('Finish recording and saving your voice before opening another letter.'); return false; }
    if (controller.getSnapshot().save === 'error' && !controller.retrySave()) { setError('Keep this page open until your latest changes can be saved.'); return false; }
    return controller.getSnapshot().phase !== 'loading';
  }
  function create() {
    if (!canLeave()) return;
    try { const id = library.create(); open(id); setCabinet(false); setRemoval(null); setError(null); }
    catch { setError('A new page could not be saved. Please try again.'); }
  }
  function browse() {
    try { refreshCabinet(); setShown(12); setCabinet(true); setRemoval(null); setError(null); }
    catch { setError('Your saved letters could not be listed. Please try again.'); }
  }
  function removalError(cause: unknown) {
    if (cause instanceof LetterRemovalError) {
      setRemoval(null);
      try { refreshCabinet(); controller.refresh(); } catch { /* Keep the existing page intact. */ }
      setError(cause.code === 'changed' ? 'This letter changed in another window. Review it before choosing Remove again.' : cause.code === 'protected' ? 'This letter has started its journey. Open it to check or cancel its pending delivery.' : 'This letter is no longer available in the cabinet.');
    } else setError('The letter could not be removed. It has been kept; please try again.');
  }
  function askRemoval(entry: LetterEntry) {
    if (!canLeave()) return;
    try { setRemoval({ ticket: library.prepareRemoval(entry.id), title: entry.title }); setError(null); }
    catch (cause) { removalError(cause); }
  }
  function confirmRemoval() {
    if (!removal || !canLeave()) return;
    try {
      library.remove(removal.ticket);
    } catch (cause) { removalError(cause); return; }
    setRemoval(null); setError(null);
    controller.refresh();
    try { refreshCabinet(); } catch { setError('The letter was removed. Reopen My letters to refresh the cabinet.'); }
    if (controller.getSnapshot().phase === 'removed') setCabinet(false);
  }
  return <WorkspaceNavigation.Provider value><View style={{ flex: 1 }}>
    <RoyalWorkspaceBar beforeBellOpen={canLeave} bellDisabled={busy || snapshot.phase === 'loading'}>
      <RoyalNavButton label="My palace" icon="gate" onPress={() => { if (canLeave()) onBack(); }} disabled={busy || snapshot.phase === 'loading'} compact={narrow} grow={narrow} />
      <RoyalNavButton label="My letters" icon="letter" onPress={browse} active={cabinet} disabled={busy} compact={narrow} grow={narrow} />
      <RoyalNavButton label="New letter" icon="star" onPress={create} disabled={busy || snapshot.phase === 'loading'} primary compact={narrow} grow={narrow} />
    </RoyalWorkspaceBar>
    {error && !cabinet && <Text role="alert" style={styles.notice}>{error}</Text>}
    {snapshot.phase === 'removed' ? <StoryShell chapter="A LITTLE SPACE FOR SOMETHING NEW"><StoryHeading eyebrow="A PAGE LAID TO REST" title="Room for new words." subtitle="This unfinished letter has been removed from this device. Your other letters are still in the cabinet." /><View style={styles.empty}><Flourish /><StoryButton label="Write a new letter" onPress={create} /></View></StoryShell> : children(controller, create, setBusy)}
    {cabinet && <StoryDialog title={removal ? 'Remove this letter?' : 'Your letters, kept with care.'} onClose={() => { if (removal) { setRemoval(null); setError(null); } else setCabinet(false); }}>
      {removal ? <>
        <View style={styles.removalSeal}><StoryIcon kind="letter" size={34} color="#A07847" /></View>
        <Text style={styles.entryTitle}>{removal.title}</Text>
        <Text style={s.body}>This permanently removes this unfinished letter{removal.ticket.kind === 'VOICE' ? ', its recording and its written version' : ' and its words'} from this device. It cannot be undone. Your other letters stay safely in the cabinet.</Text>
        <StoryButton label="Remove letter" onPress={confirmRemoval} disabled={busy} />
        <StoryButton label="Keep this letter" secondary onPress={() => { setRemoval(null); setError(null); }} />
      </> : <>
        <Text style={s.body}>Every page has its own place. Open an unfinished thought, or remove a letter you no longer wish to keep.</Text>
        <RoyalNavButton label="Start another letter" icon="star" primary onPress={create} disabled={busy} />
        {entries.length === 0 && <Text style={s.body}>The cabinet is quiet. A fresh page is here whenever you need it.</Text>}
        {entries.slice(0, shown).map((entry, index) => <View key={entry.id} testID={'cabinet-letter-' + entry.id} style={styles.entry}>
          <View style={[styles.entryInset, { pointerEvents: "none" }]} />
          <View style={styles.entryHeading}><View style={styles.entrySeal}><StoryIcon kind={entry.stage === 'sealed' ? 'letter' : 'star'} size={21} color="#96713F" /></View><View style={{ flex: 1, gap: 5 }}><Text style={styles.folio}>FOLIO {String(index + 1).padStart(2, '0')}</Text><Text style={styles.entryTitle} numberOfLines={2}>{entry.title}</Text></View></View>
          <Text style={styles.note}>{letterStageLabel(entry.stage)}{entry.cleanup ? ' · clearing local recording' : ''}</Text>
          {entry.updatedAt && <Text style={styles.date}>{new Date(entry.updatedAt).toLocaleString()}</Text>}
          <View style={styles.entryActions}><RoyalNavButton label={'Open ' + entry.title} icon="key" compact onPress={() => { if (canLeave()) { open(entry.id); setCabinet(false); setError(null); } }} />
            {(entry.stage === 'writing' || entry.stage === 'sealed') && <Pressable accessibilityRole="button" accessibilityLabel={'Remove ' + entry.title} disabled={busy} aria-disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => askRemoval(entry)} style={({ pressed }) => [styles.remove, pressed && { backgroundColor: '#EAD5C3' }, busy && { opacity: .45 }]}><StoryIcon kind="close" size={15} color="#8D5847" /><Text style={styles.removeLabel}>Remove letter</Text></Pressable>}
          </View>
        </View>)}
        {shown < entries.length && <TextAction label="More letters" onPress={() => setShown(value => value + 12)} />}
        {cleanupCount > 0 && <View style={styles.cleanup}><Text style={s.body}>A removed letter’s recording is still being cleared from this device. Its words are gone and you can keep writing.</Text><TextAction label="Retry clearing removed recordings" onPress={() => { try { library.retryRemovalCleanup(); } catch { setError('The old recording could not be cleared yet. Please try again.'); } }} /></View>}
      </>}
      {error && <Text role="alert" style={styles.error}>{error}</Text>}
    </StoryDialog>}
  </View></WorkspaceNavigation.Provider>;
}
const styles = StyleSheet.create({
  restore: { backgroundColor: '#EEE2C9', padding: 25, gap: 16 }, note: { color: '#796648', fontSize: 12, lineHeight: 20 }, date: { color: '#8B7653', fontSize: 10, lineHeight: 18 },
  notice: { color: '#913E30', backgroundColor: '#F3E3CA', padding: 12, fontSize: 13, lineHeight: 21 }, error: { color: '#913E30', fontSize: 13, lineHeight: 21 },
  empty: { width: '100%', maxWidth: 340, alignSelf: 'center', gap: 26, alignItems: 'center', paddingVertical: 25 },
  entry: { borderWidth: 1, borderColor: '#B99B64', borderTopLeftRadius: 23, borderTopRightRadius: 23, borderBottomLeftRadius: 5, borderBottomRightRadius: 5, padding: 20, backgroundColor: '#EFE1C1', gap: 9, boxShadow: '0px 3px 7px rgba(83,58,28,.08)' },
  entryInset: { ...StyleSheet.absoluteFill, margin: 5, borderWidth: 1, borderColor: '#D5BD8C', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  entryHeading: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 4 }, folio: { color: '#9A7C48', fontSize: 8, lineHeight: 12, letterSpacing: 2 }, entryTitle: { color: '#5A432A', fontFamily: serif, fontSize: 21, lineHeight: 28 },
  entrySeal: { height: 39, width: 35, backgroundColor: '#E6D2A6', borderWidth: 1, borderColor: '#B49661', borderRadius: 20, alignItems: 'center', justifyContent: 'center' }, entryActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginTop: 8 },
  remove: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderWidth: 1, borderColor: '#CAAB8C', borderRadius: 4 }, removeLabel: { color: '#875542', fontFamily: serif, fontSize: 14 },
  removalSeal: { height: 65, width: 65, alignSelf: 'center', borderRadius: 34, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAD4AB', borderWidth: 1, borderColor: '#B1945F' },
  cleanup: { padding: 13, borderColor: '#C7AF85', borderWidth: 1, backgroundColor: '#EFE3C9' },
});
