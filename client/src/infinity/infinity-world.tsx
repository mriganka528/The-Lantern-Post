import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import type { WorldBounds, WorldStar } from '@lantern-post/shared-types';
import { RealmCamera, realmScale } from '../letters/realm-camera';
import type { CameraSnapshot } from '../letters/realm-camera';
import { RealmViewport } from '../letters/realm-viewport';
import { StoryButton, StoryDialog, StoryHeading, StoryShell, TextAction, s } from '../storybook/story-ui';
import { Flourish, StoryIcon } from '../storybook/ornaments';
import { RoyalNavButton } from '../storybook/royal-navigation';
import { serif } from '../storybook/theme';
import { useAmbientMotion } from '../storybook/use-ambient-motion';
import { useReducedMotion } from '../storybook/use-reduced-motion';
import type { SafetyTransport } from '../safety/safety-api';
import type { InfinityTransport } from './infinity-api';
import { InfinityScenery } from './infinity-scenery';
import { starClusters, viewBounds } from './world-map';
import { sampleStars } from './sample-stars';
import { WorldReader } from './world-reader';
import { StarSparkles } from './star-sparkles';
import type { StarSparkle } from './star-sparkles';
import { InfinityLightSwitch } from './infinity-light-switch';
import { InfinityLightingProvider, useInfinityLighting } from './use-infinity-lighting';
export const infinityKey = (ownerId: string) => ['infinity', ownerId] as const;
interface InfinityWorldProps { ownerId: string; api: InfinityTransport; safety: SafetyTransport; onBack: () => void; onWrite: () => void; }
export function InfinityWorld(props: InfinityWorldProps) {
  return <InfinityLightingProvider><WorldScene {...props} /></InfinityLightingProvider>;
}
function WorldScene({ ownerId, api, safety, onBack, onWrite }: InfinityWorldProps) {
  const { width } = useWindowDimensions(); const [camera] = useState(() => new RealmCamera()); const view = useSyncExternalStore(camera.subscribe, camera.getSnapshot, camera.getSnapshot);
  const { lighting } = useInfinityLighting();
  const { enabled, setEnabled } = useAmbientMotion(); const reduced = useReducedMotion(); const [preview, setPreview] = useState(false); const [selected, setSelected] = useState<string | null>(null); const [mine, setMine] = useState(false); const cache = useQueryClient();
  const key = JSON.stringify(viewBounds(view)); const measured = view.width > 1; const [queryBox, setQueryBox] = useState<WorldBounds | null>(null);
  useEffect(() => { if (!measured) return; const timer = setTimeout(() => setQueryBox(JSON.parse(key) as WorldBounds), 240); return () => clearTimeout(timer); }, [key, measured]);
  const refresh = () => { void cache.resetQueries({ queryKey: infinityKey(ownerId) }); };
  return <StoryShell chapter="THE INFINITY WORLD" actions={<TextAction label="My palace" onPress={onBack} />}>
    <StoryHeading eyebrow="BEYOND THE LAST PALACE GATE" title="A sky for every little light." subtitle="Letters left among the stars. A thought, a wish, a voice — waiting quietly for someone to find it." />
    {preview && <View style={styles.preview}><Text style={styles.previewTitle}>STORYBOOK PREVIEW</Text><Text style={s.body}>These are sample letters from the app. Nothing is shared, and your own draft stays untouched.</Text><TextAction label="Return to the shared sky" onPress={() => { setPreview(false); setSelected(null); }} /></View>}
    <View style={styles.toolbar}><View style={styles.controls}><Control label="Zoom out of the sky" title="−" onPress={() => camera.zoomBy(-.25)} disabled={view.zoom <= 1} /><Text style={styles.zoom}>{Math.round(view.zoom * 100)}%</Text><Control label="Zoom into the sky" title="+" onPress={() => camera.zoomBy(.25)} disabled={view.zoom >= 3} /><Control label="Reset sky view" title="Recenter" onPress={() => camera.reset()} /></View>
      <InfinityLightSwitch />
      {!reduced && <Pressable accessibilityRole="switch" accessibilityLabel="Infinity World ambient motion" accessibilityState={{ checked: enabled }} aria-checked={enabled} onPress={() => setEnabled(!enabled)} style={styles.motion}><Text style={styles.small}>Motion {enabled ? 'on' : 'off'}</Text></Pressable>}
    </View>
    <View testID="infinity-world"><RealmViewport camera={camera} height={width < 600 ? 470 : 630} interactive label="Explore the Infinity World. Drag or use arrow keys to pan. Pinch or use plus and minus to zoom. Select a glowing star to read a letter.">
      {view.width > 1 && <><View style={[{ position: 'absolute', width: 1600, height: 1000, left: (view.width - 1600) / 2, top: (view.height - 1000) / 2, transform: [{ translateX: view.x }, { translateY: view.y }, { scale: realmScale(view.width, view.height) * view.zoom }] }, { pointerEvents: "none" }]}><InfinityScenery /></View>
        {queryBox && <SkyStars key={`${preview}:${JSON.stringify(queryBox)}`} ownerId={ownerId} api={api} preview={preview} bounds={queryBox} view={view} onOpen={setSelected} camera={camera} night={lighting === 'night'} />}
      </>}
    </RealmViewport></View>
    <Text style={styles.hint}>{Platform.OS === 'web' ? 'Drag to wander · Pinch or Ctrl + scroll to zoom · Arrow keys move the sky' : 'Drag to wander · Pinch to move closer'}</Text><Text style={styles.hint}>Touch a little star to open its letter. Hover to wake its sparkle; numbered stars hold a constellation.</Text>
    {!preview && <View testID="infinity-actions" style={actionStyles.court}>
      <View style={actionStyles.heading}><Flourish width={60} /><Text style={actionStyles.eyebrow}>THE CELESTIAL POST</Text><Flourish width={60} /></View>
      <Text style={actionStyles.caption}>A little wish, a treasured light.</Text>
      <View style={{ alignSelf: 'center', maxWidth: '100%' }}><StoryButton label="Write a letter to the sky" onPress={onWrite} /></View>
      <View style={[actionStyles.links, width < 500 && { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' }]}>
        <RoyalNavButton icon="star" label="Explore sample stars" onPress={() => { setPreview(true); setSelected(null); camera.reset(); }} />
        <RoyalNavButton icon="moon" active={mine} label={mine ? 'Hide my shared lights' : 'My shared lights'} onPress={() => setMine(value => !value)} />
        <RoyalNavButton icon="arrow" label="Refresh the sky" onPress={refresh} />
      </View>
    </View>}
    {mine && !preview && <MyLights ownerId={ownerId} api={api} onOpen={setSelected} />}
    {selected && <WorldReader key={`${preview}:${selected}`} id={selected} ownerId={ownerId} api={api} safety={safety} preview={preview} onClose={() => setSelected(null)} onChanged={refresh} />}
  </StoryShell>;
}
function SkyStars({ ownerId, api, preview, bounds, view, onOpen, camera, night }: { ownerId: string; api: InfinityTransport; preview: boolean; bounds: WorldBounds; view: CameraSnapshot; onOpen: (id: string) => void; camera: RealmCamera; night: boolean }) {
  const [cluster, setCluster] = useState<WorldStar[] | null>(null); const [list, setList] = useState(false);
  const [sparkle, setSparkle] = useState<StarSparkle | null>(null); const opening = useRef<ReturnType<typeof setTimeout> | undefined>(undefined); const reduced = useReducedMotion();
  useEffect(() => () => clearTimeout(opening.current), []);
  const glow = (x: number, y: number) => setSparkle(before => ({ x, y, sequence: (before?.sequence ?? 0) + 1 }));
  const query = useInfiniteQuery({ queryKey: [...infinityKey(ownerId), 'view', bounds], initialPageParam: null as string | null, queryFn: ({ pageParam, signal }) => api.list(bounds, pageParam, signal), getNextPageParam: page => page.nextCursor, maxPages: 3, gcTime: 0, staleTime: 0, enabled: !preview });
  const stars = useMemo(() => preview ? sampleStars : query.data?.pages.flatMap(page => page.stars) ?? [], [preview, query.data]);
  const groups = starClusters(stars, view); const visible = groups.flatMap(group => group.stars);
  return <><View style={[StyleSheet.absoluteFill, { pointerEvents: "box-none" }]}>
    {groups.map((group, index) => <Pressable key={group.id} testID={group.stars.length === 1 ? `world-star-${group.stars[0]!.id}` : 'world-star-cluster'} accessibilityRole="button" accessibilityLabel={group.stars.length > 1 ? `Open a constellation of ${group.stars.length} letters` : `Open ${group.stars[0]!.type === 'VOICE' ? 'voice' : 'written'} light ${index + 1}`} onHoverIn={() => glow(group.x, group.y)} onFocus={() => glow(group.x, group.y)} onPressIn={() => glow(group.x, group.y)} onPress={() => { clearTimeout(opening.current); opening.current = setTimeout(() => { if (group.stars.length === 1) onOpen(group.stars[0]!.id); else setCluster(group.stars); }, reduced ? 0 : 110); }} style={[styles.star, { left: Math.max(0, Math.min(view.width - 44, group.x - 22)), top: Math.max(0, Math.min(view.height - 44, group.y - 22)) }]}>
      <View style={[styles.starLight, night && { backgroundColor: '#474263', boxShadow: '0px 0px 10px rgba(255,228,150,.75)' }]}><StoryIcon kind="star" size={21} color={night ? '#FFE4A1' : '#AD8248'} /></View>{group.stars.length > 1 && <Text style={styles.clusterBadge}>{group.stars.length}</Text>}
    </Pressable>)}
    <StarSparkles at={sparkle} />
    <View style={styles.skyStatus}>{!preview && query.isPending ? <><ActivityIndicator color="#94723C" /><Text style={styles.small}>Finding little lights…</Text></> : !preview && query.isError ? <><Text style={styles.small}>The sky is behind a little mist.</Text><TextAction label="Try finding lights again" onPress={() => { void query.refetch(); }} /></> : <><Text style={styles.small}>{visible.length ? `${visible.length} ${preview ? 'sample ' : ''}light${visible.length === 1 ? '' : 's'} in view` : 'A quiet corner of the sky.'}</Text>{visible.length > 0 && <TextAction label="List the lights in view" onPress={() => setList(true)} />}{!preview && query.hasNextPage && <TextAction label={query.isFetchingNextPage ? 'Finding more lights…' : 'More lights in this view'} disabled={query.isFetchingNextPage} onPress={() => { void query.fetchNextPage(); }} />}</> }</View>
  </View>
  {(cluster || list) && <StoryDialog title={cluster ? 'A little constellation' : 'Lights in this part of the sky'} onClose={() => { setCluster(null); setList(false); }}>
    {cluster && view.zoom < 3 && <StoryButton label="Move closer to this constellation" onPress={() => { camera.focus({ x: cluster.reduce((sum, star) => sum + star.x, 0) / cluster.length, y: cluster.reduce((sum, star) => sum + star.y, 0) / cluster.length }, Math.min(3, view.zoom + .75)); setCluster(null); }} />}
    {(cluster ?? visible).map((star, i) => <TextAction key={star.id} label={`${star.type === 'VOICE' ? 'A voice' : 'A letter'} among the stars · ${i + 1}`} onPress={() => { setCluster(null); setList(false); onOpen(star.id); }} />)}
  </StoryDialog>}
  </>;
}
function MyLights({ ownerId, api, onOpen }: { ownerId: string; api: InfinityTransport; onOpen: (id: string) => void }) {
  const list = useInfiniteQuery({ queryKey: [...infinityKey(ownerId), 'mine'], initialPageParam: null as string | null, queryFn: ({ pageParam, signal }) => api.mine(pageParam, signal), getNextPageParam: page => page.nextCursor, maxPages: 3, gcTime: 0, staleTime: 0 });
  const stars = list.data?.pages.flatMap(page => page.stars) ?? [];
  return <View style={styles.preview}><Text style={styles.subheading}>The lights you left here.</Text>{list.isPending ? <ActivityIndicator color="#94723C" /> : list.isError ? <><Text style={s.body}>Your lights could not be found.</Text><TextAction label="Find my lights again" onPress={() => { void list.refetch(); }} /></> : !stars.length ? <Text style={s.body}>Your first little light is still waiting to be written.</Text> : stars.map((star, i) => <TextAction key={star.id} label={`Open my ${star.type === 'VOICE' ? 'voice' : 'written'} light ${i + 1}`} onPress={() => onOpen(star.id)} />)}{list.hasNextPage && <TextAction label="More of my lights" onPress={() => { void list.fetchNextPage(); }} disabled={list.isFetchingNextPage} />}</View>;
}
function Control({ label, title, onPress, disabled = false }: { label: string; title: string; onPress: () => void; disabled?: boolean }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={[styles.control, disabled && { opacity: .45 }]}><Text style={styles.controlText}>{title}</Text></Pressable>; }
const actionStyles = StyleSheet.create({
  court: { alignSelf: 'center', width: '100%', maxWidth: 680, marginTop: 24, padding: 16, gap: 13, borderWidth: 1, borderColor: '#C7AE7A', borderTopLeftRadius: 18, borderTopRightRadius: 18, borderBottomLeftRadius: 6, borderBottomRightRadius: 6, backgroundColor: '#F3EAD8' },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  eyebrow: { color: '#887043', fontSize: 9, letterSpacing: 1.6, lineHeight: 16 },
  caption: { color: '#796447', fontFamily: serif, fontStyle: 'italic', fontSize: 17, textAlign: 'center' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
});
const styles = StyleSheet.create({ toolbar: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 12 }, controls: { flexDirection: 'row', alignItems: 'center', gap: 9 }, control: { minWidth: 44, minHeight: 44, paddingHorizontal: 13, borderWidth: 1, borderColor: '#BBA47C', backgroundColor: '#EEE3CB', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }, controlText: { color: '#695439', fontFamily: serif, fontSize: 18 }, zoom: { fontSize: 11, color: '#897253' }, motion: { minHeight: 44, justifyContent: 'center' }, small: { color: '#68563F', fontSize: 11, lineHeight: 18, textAlign: 'center' }, hint: { color: '#8A7960', fontSize: 11, lineHeight: 20, textAlign: 'center', marginTop: 9 }, star: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, starLight: { width: 23, height: 23, borderRadius: 12, backgroundColor: 'rgba(255,246,215,.85)', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 0px 8px rgba(255,239,172,.7)' }, clusterBadge: { position: 'absolute', right: 1, top: 1, minWidth: 15, paddingHorizontal: 3, borderRadius: 8, backgroundColor: '#F5E5BB', color: '#80643D', fontSize: 9, lineHeight: 15, textAlign: 'center' }, skyStatus: { position: 'absolute', bottom: 12, left: 12, maxWidth: 235, paddingHorizontal: 12, paddingVertical: 5, borderColor: '#CEB887', borderWidth: 1, borderRadius: 5, backgroundColor: 'rgba(249,242,222,.96)' }, preview: { padding: 21, gap: 12, marginVertical: 18, backgroundColor: '#F1E7D1', borderColor: '#C5AE81', borderWidth: 1, borderRadius: 5 }, previewTitle: { color: '#81673F', fontSize: 11, letterSpacing: 1.7 }, subheading: { fontFamily: serif, color: '#6A573C', fontSize: 25 }, invitations: { alignItems: 'center', gap: 10, marginTop: 24 } });
