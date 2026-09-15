import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren, RefObject } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { TourGuideProvider, TourGuideOverlay, useTourGuide, useTourScroll } from '@wrack/react-native-tour-guide';
import type { TourButtonProps, TourProgressProps, TourStep } from '@wrack/react-native-tour-guide';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GuidanceContext } from './guidance-context';
import { GuidancePreference, guidanceSteps } from './guidance-model';
import type { GuidanceTargetId } from './guidance-model';
import { guidanceStorage } from './guidance-storage';
import { useAppActive } from '../storybook/use-ambient-motion';
import { useBlockingPalaceModal, usePalaceModalOpen } from '../realtime/palace-live-state';
import { useReducedMotion } from '../storybook/use-reduced-motion';
import { serif } from '../storybook/theme';

const preference = new GuidancePreference(guidanceStorage);
const buttonStyle = { minHeight: 44, minWidth: 44, paddingHorizontal: 12, justifyContent: 'center' as const, alignItems: 'center' as const, borderRadius: 5 };
function NextButton({ label, onPress, disabled, isLast }: TourButtonProps) { return <Pressable accessibilityRole="button" accessibilityLabel={isLast ? 'Finish guidance' : 'Next guidance step'} disabled={disabled} onPress={onPress} style={[buttonStyle,{backgroundColor:'#465448',opacity:disabled?.5:1}]}><Text style={{color:'#FFF8E9',fontSize:13}}>{label}</Text></Pressable>; }
function PrevButton({ label, onPress }: TourButtonProps) { return <Pressable accessibilityRole="button" accessibilityLabel="Previous guidance step" onPress={onPress} style={buttonStyle}><Text style={{color:'#665944',fontSize:12}}>{label}</Text></Pressable>; }
function SkipButton({ label, onPress }: TourButtonProps) { return <Pressable accessibilityRole="button" accessibilityLabel="Skip guidance" onPress={onPress} style={buttonStyle}><Text style={{color:'#7F6C4B',fontSize:12}}>{label}</Text></Pressable>; }
function StepCounter({ currentStep, totalSteps }: TourProgressProps) { const {activeSteps}=useTourGuide(); return <Text testID="palace-guidance" nativeID={`guidance-step-${activeSteps[currentStep]?.id}`} style={{color:'#887043',fontSize:10}}>{currentStep+1} / {totalSteps}</Text>; }
function TourModalLease() { useBlockingPalaceModal('guidance'); return null; }

export function PalaceGuidanceProvider(props: PropsWithChildren<{ enabled?: boolean }>) {
  return <TourGuideProvider><GuidanceCoordinator {...props} /></TourGuideProvider>;
}
function GuidanceCoordinator({ children, enabled = true }: PropsWithChildren<{ enabled?: boolean }>) {
  const {isActive,isPaused,startTour,skipTour,pauseTour,resumeTour}=useTourGuide();
  const {onScroll:reportScroll,onMomentumScrollEnd}=useTourScroll(); const foreground=useAppActive(); const anotherModal=usePalaceModalOpen(true);
  const reduced=useReducedMotion(); const {width,height}=useWindowDimensions(); const insets=useSafeAreaInsets();
  const [ready,setReady]=useState(false),[requested,setRequested]=useState(false),[preferenceError,setPreferenceError]=useState(false);
  const [targets,setTargets]=useState(()=>new Map<GuidanceTargetId,RefObject<View|null>>());
  const scrollRef=useRef<ScrollView>(null),offset=useRef(0),returnScroll=useRef(0),mounted=useRef(true),canRestore=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{canRestore.current=enabled&&foreground;},[enabled,foreground]);
  const register=useCallback((id:GuidanceTargetId,ref:RefObject<View|null>)=>{setTargets(old=>new Map(old).set(id,ref));return()=>setTargets(old=>{if(old.get(id)!==ref)return old;const next=new Map(old);next.delete(id);return next;});},[]);
  const onScroll=useCallback((event:NativeSyntheticEvent<NativeScrollEvent>)=>{offset.current=event.nativeEvent.contentOffset.y;reportScroll(event);},[reportScroll]);
  const start=useCallback(()=>{if(enabled)setRequested(true);},[enabled]);
  const retryPreference=useCallback(()=>setPreferenceError(!preference.retry()),[]);
  const finish=useCallback((completed:boolean)=>{const saved=preference.mark(completed?'complete':'skipped');if(mounted.current){setPreferenceError(!saved);setRequested(false);}if(canRestore.current)scrollRef.current?.scrollTo({y:returnScroll.current,animated:false});},[]);
  useEffect(()=>{if(!isActive)return;if(!enabled)skipTour();else if(!foreground||anotherModal){if(!isPaused)pauseTour();}else if(isPaused)resumeTour();},[enabled,foreground,anotherModal,isActive,isPaused,skipTour,pauseTour,resumeTour]);
  useEffect(()=>{if(enabled)return;const timer=setTimeout(()=>setRequested(false),0);return()=>clearTimeout(timer);},[enabled]);
  useEffect(()=>{
    if(!enabled||!foreground||!ready||anotherModal||isActive||!targets.get('companions')?.current)return;
    // The palace signals readiness after its entrance closes. Its target refs
    // are already mounted; start on the next frame instead of a restartable
    // 350/450-ms timer that can keep slipping as the home finishes loading.
    const frame=requestAnimationFrame(()=>{
      if(!requested&&!preference.claimAutomatic())return;
      if(requested)preference.mark('seen');
      setPreferenceError(preference.needsRetry);setRequested(false);returnScroll.current=offset.current;
      // The SDK treats delayBefore:0 as its 100-ms default. A minimal explicit
      // delay uses its own measurement pipeline without an extra startup pause.
      const steps:TourStep[]=guidanceSteps.filter(step=>targets.has(step.id)).map((step,index)=>({id:step.id,targetRef:targets.get(step.id),title:step.title,description:step.text,tooltipPosition:'auto',spotlightPadding:5,spotlightBorderRadius:step.id==='bell'?24:8,...(index===0?{delayBefore:1,motion:'none' as const}:{}),scrollToTarget:{scrollRef,animated:index>0&&!reduced,getCurrentScrollOffset:()=>offset.current}}));
      startTour(steps,{
        tourId:'palace-guidance-v1',scrollRef,getCurrentScrollOffset:()=>offset.current,insets,
        tooltipWidth:280,autoPositionTooltip:true,followTarget:false,waitForInteractions:false,
        overlayMode:'modal',motion:reduced?'none':'fade',animationDuration:reduced?0:180,
        nextButtonText:'Next',prevButtonText:'Back',skipButtonText:'Skip',doneButtonText:'Finish',
        components:{NextButton,PrevButton,SkipButton,StepCounter},onTourEnd:finish,
        tooltipStyles:{backgroundColor:'#F8F4EA',borderRadius:12,titleColor:'#403C32',descriptionColor:'#726B5D',titleStyle:{fontFamily:serif,fontSize:21,fontWeight:'400',lineHeight:27},descriptionStyle:{fontSize:12,lineHeight:20},containerStyle:{borderWidth:1,borderColor:'#B99B61'},primaryButtonColor:'#465448',skipButtonColor:'#877044'},
        spotlightStyles:{overlayColor:'#1A2320',overlayOpacity:.72,enablePulse:false,enableBlur:false,enableGradient:false},
        accessibilityLabelPrefix:'Palace guidance',
      });
    });
    return()=>cancelAnimationFrame(frame);
  },[enabled,foreground,ready,anotherModal,isActive,requested,targets,startTour,finish,reduced,insets]);
  const visible=isActive&&!isPaused&&enabled&&foreground&&!anotherModal;
  const context=useMemo(()=>({active:visible,scrollRef,onScroll,onMomentumScrollEnd,register,setReady,start,preferenceError,retryPreference}),[visible,onScroll,onMomentumScrollEnd,register,start,preferenceError,retryPreference]);
  return <GuidanceContext.Provider value={context}>{children}<TourGuideOverlay key={`${width}:${height}`} />{visible&&<TourModalLease />}</GuidanceContext.Provider>;
}
