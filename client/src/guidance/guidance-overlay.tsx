import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { guidancePlacement } from './guidance-model';
import type { GuidanceRect, GuidanceStep } from './guidance-model';
import { LanternMark, StoryIcon } from '../storybook/ornaments';
import { bodyFont, gold, ink, mutedInk, paper, serif } from '../storybook/theme';
import { useBlockingPalaceModal } from '../realtime/palace-live-state';

interface Measurable { measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void }
function measure(node: Measurable | null | undefined): Promise<GuidanceRect | null> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), 250);
    if (!node) { clearTimeout(timer); resolve(null); return; }
    try { node.measureInWindow((x, y, width, height) => { clearTimeout(timer); resolve(width > 0 && height > 0 && [x,y,width,height].every(Number.isFinite) ? { x, y, width, height } : null); }); }
    catch { clearTimeout(timer); resolve(null); }
  });
}
type Props = { step: GuidanceStep; index: number; total: number; revision: number; target: RefObject<View | null>; scrollRef: RefObject<ScrollView | null>; scrollOffset: RefObject<number>; onSkip(): void; onNext(): void; onBack(): void };

export function GuidanceOverlay({ step, index, total, revision, target, scrollRef, scrollOffset, onSkip, onNext, onBack }: Props) {
  useBlockingPalaceModal('guidance');
  const dimensions = useWindowDimensions(); const insets = useSafeAreaInsets();
  const root = useRef<View>(null); const title = useRef<Text>(null);
  const [frame, setFrame] = useState({ width: dimensions.width, height: dimensions.height });
  const [box, setBox] = useState<{ step: string; viewport: string; rect: GuidanceRect } | null>(null);
  const [failed, setFailed] = useState(false); const [retry, setRetry] = useState(0);
  const [content, setContent] = useState<{ step: string; height: number } | null>(null);
  const scrolled = useRef('');
  useEffect(() => {
    let live = true; let timer: ReturnType<typeof setTimeout>;
    const key = `${step.id}:${dimensions.width}:${dimensions.height}:${retry}`;
    async function locate(attempt = 0) {
      const [anchor, origin, viewport] = await Promise.all([measure(target.current), measure(root.current), measure(scrollRef.current?.getNativeScrollRef())]);
      if (!live) return;
      if (!anchor || !origin || !viewport) {
        if (attempt < 2) timer = setTimeout(() => { void locate(attempt + 1); }, 90);
        else setFailed(true);
        return;
      }
      if (scrolled.current !== key) {
        scrolled.current = key;
        const y = Math.max(0, scrollOffset.current + anchor.y - Math.max(viewport.y, origin.y + insets.top) - 22);
        if (Math.abs(y - scrollOffset.current) > 3) {
          scrollRef.current?.scrollTo({ y, animated: false });
          timer = setTimeout(() => { void locate(); }, 90); return;
        }
      }
      setFrame({ width: origin.width, height: origin.height });
      setBox({ step: step.id, viewport: `${dimensions.width}:${dimensions.height}`, rect: { ...anchor, x: anchor.x - origin.x, y: anchor.y - origin.y } });
      setFailed(false);
    }
    timer = setTimeout(() => { void locate(); }, 40);
    return () => { live = false; clearTimeout(timer); };
  }, [step.id, target, scrollRef, scrollOffset, revision, dimensions.width, dimensions.height, insets.top, retry]);
  const placement = box?.step === step.id && box.viewport === `${dimensions.width}:${dimensions.height}` ? guidancePlacement(box.rect, { ...frame, top: insets.top, bottom: insets.bottom }, dimensions.fontScale, content?.step === step.id ? content.height : undefined) : null;
  useEffect(() => {
    if (box?.step !== step.id) return;
    const timer = setTimeout(() => {
      if (Platform.OS !== 'web') { const node = findNodeHandle(title.current); if (node) AccessibilityInfo.setAccessibilityFocus(node); }
      AccessibilityInfo.announceForAccessibility(`Guidance, ${index + 1} of ${total}. ${step.title}. ${step.text}`);
    }, 120);
    return () => clearTimeout(timer);
  }, [step, index, total, box?.step]);
  const focus = placement?.focus;
  return <Modal transparent visible animationType="none" onRequestClose={onSkip}>
    <View ref={root} collapsable={false} testID="palace-guidance" nativeID={`guidance-step-${step.id}`} style={styles.overlay} onLayout={() => setRetry(value => value + 1)}>
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} accessible={false} importantForAccessibility="no-hide-descendants">
        {focus ? <>
          <View style={[styles.shade, { left: 0, top: 0, width: frame.width, height: focus.y }]} />
          <View style={[styles.shade, { left: 0, top: focus.y, width: focus.x, height: focus.height }]} />
          <View style={[styles.shade, { left: focus.x + focus.width, top: focus.y, right: 0, height: focus.height }]} />
          <View style={[styles.shade, { left: 0, top: focus.y + focus.height, right: 0, bottom: 0 }]} />
          <View testID="guidance-highlight" style={[styles.highlight, { left: focus.x, top: focus.y, width: focus.width, height: focus.height }]}><View style={styles.highlightInset} /></View>
          <View testID="guidance-pointer" style={[styles.pointer, { left: placement.pointerX - 6, top: placement.side === 'below' ? placement.panel.y - 6 : placement.panel.y + placement.panel.height - 6 }]} />
        </> : <View style={[StyleSheet.absoluteFill, styles.shade]} />}
      </View>
      <View testID="guidance-caption" accessibilityViewIsModal style={[styles.caption, placement ? { left: placement.panel.x, top: placement.panel.y, width: placement.panel.width, height: placement.panel.height } : { left: 12, right: 12, bottom: insets.bottom + 16, height: Math.min(268, frame.height - insets.top - insets.bottom - 24) }]}>
        <ScrollView key={step.id} style={styles.words} contentContainerStyle={{ paddingBottom: 2, gap: 12 }} onContentSizeChange={(_width, height) => setContent(old => old?.step === step.id && old.height === height ? old : { step: step.id, height })}>
          <View style={styles.captionHeading}><LanternMark size={22} /><View style={styles.headingWords}><Text style={styles.chapter}>A LANTERN TO GUIDE YOU · {index + 1} / {total}</Text><Text ref={title} accessibilityRole="header" style={styles.title}>{step.title}</Text></View></View>
          <Text style={styles.body}>{step.text}</Text>{failed && <><Text style={styles.notice}>This part is not in view yet. Try finding it again, or continue the guidance.</Text><Pressable accessibilityRole="button" onPress={() => { setFailed(false); setRetry(value => value + 1); }} style={styles.retry}><Text style={styles.skipText}>Find this section again</Text></Pressable></>}
        </ScrollView>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip guidance" onPress={onSkip} style={styles.skip}><Text style={styles.skipText}>Skip</Text></Pressable>
          <View style={styles.pages}><Pressable accessibilityRole="button" accessibilityLabel="Previous guidance step" accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={onBack} style={[styles.back, index === 0 && { opacity: .35 }]}><Text style={styles.backText}>Back</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={index === total - 1 ? 'Finish guidance' : 'Next guidance step'} onPress={onNext} style={({ pressed }) => [styles.next, pressed && { backgroundColor: '#344438' }]}><Text style={styles.nextText}>{index === total - 1 ? 'Finish' : 'Next'}</Text><StoryIcon kind={index === total - 1 ? 'star' : 'arrow'} size={15} color="#ECD8A6" /></Pressable></View>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1 }, shade: { position: 'absolute', backgroundColor: 'rgba(26, 35, 32, .73)' },
  highlight: { position: 'absolute', borderWidth: 2, borderColor: '#E5C57B', borderRadius: 10, boxShadow: '0 0 16px rgba(229,197,123,.28)' }, highlightInset: { ...StyleSheet.absoluteFill, margin: -5, borderWidth: 1, borderColor: 'rgba(232,208,151,.55)', borderRadius: 14 },
  pointer: { position: 'absolute', width: 13, height: 13, backgroundColor: paper, borderWidth: 1, borderColor: gold, transform: [{ rotate: '45deg' }] },
  caption: { position: 'absolute', padding: 16, gap: 11, borderWidth: 1, borderColor: '#B99B61', borderRadius: 10, borderTopLeftRadius: 24, backgroundColor: paper, boxShadow: '0 8px 28px rgba(16,24,18,.22)' },
  captionHeading: { flexDirection: 'row', gap: 11, alignItems: 'center', flexShrink: 0 }, headingWords: { flex: 1, gap: 5 },
  chapter: { fontFamily: bodyFont, fontSize: 8, lineHeight: 12, letterSpacing: 1.15, color: '#806B42' }, title: { fontFamily: serif, fontSize: 21, lineHeight: 26, color: ink },
  words: { flex: 1, minHeight: 0 }, body: { fontFamily: bodyFont, fontSize: 12, lineHeight: 20, color: mutedInk }, notice: { fontSize: 11, lineHeight: 18, color: '#856442', marginTop: 7 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexShrink: 0 }, pages: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  skip: { minWidth: 44, minHeight: 44, justifyContent: 'center' }, skipText: { fontFamily: bodyFont, fontSize: 12, color: '#7F7057', textDecorationLine: 'underline' },
  back: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, backText: { fontFamily: bodyFont, fontSize: 12, color: '#655B49' },
  next: { minWidth: 85, minHeight: 44, paddingHorizontal: 14, borderWidth: 1, borderColor: '#344438', backgroundColor: '#465448', borderRadius: 5, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, nextText: { fontFamily: bodyFont, fontSize: 13, color: '#FFF8E9' }, retry: { minHeight: 44, justifyContent: 'center' },
});
