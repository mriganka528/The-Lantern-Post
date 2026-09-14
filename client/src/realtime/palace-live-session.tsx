import { useEffect,useRef,useState } from 'react';
import { AppState,Pressable,Text,View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { PalaceLiveEvent } from '@lantern-post/shared-types';
import type { GetSessionToken } from '../api/client';
import { env } from '../config/env';
import { draftStorage } from '../letters/draft-storage';
import { closeLocalAccount } from '../account/account-local';
import { PalaceLiveChannel } from './palace-live-channel';
import type { SocketPort } from '../chat/chat-socket';
import { claimArrival,publishPalaceEvent,setPalaceConnected,usePalaceModalOpen,watchArrivalDismissal } from './palace-live-state';
import { arrivalCopy,eventDestination } from './palace-live-contract';
import type { PalaceDestination } from './palace-live-contract';
import { alertKey,inAppAlertsEnabled } from './palace-alert-settings';
import { RoyalNavButton } from '../storybook/royal-navigation';
import { PalaceCrest } from '../letters/antique-assets';
import { s } from '../storybook/story-ui';
const socketFactory=(url:string)=>new WebSocket(url) as unknown as SocketPort;
const pause=(signal:AbortSignal,ms:number)=>new Promise<void>(resolve=>{if(signal.aborted){resolve();return;}const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,ms);signal.addEventListener('abort',done,{once:true});});
export function PalaceLiveSession({ownerId,getToken,onOpen,chatPeerId,createSocket=socketFactory}:{ownerId:string;getToken:GetSessionToken;onOpen:(destination:PalaceDestination)=>void;chatPeerId?:string;createSocket?:(url:string)=>SocketPort}) {
  const modalOpen=usePalaceModalOpen();
  const cache=useQueryClient();const [toast,setToast]=useState<PalaceLiveEvent|null>(null);const peer=useRef(chatPeerId);useEffect(()=>{peer.current=chatPeerId;},[chatPeerId]);
  useEffect(() => watchArrivalDismissal(ownerId, () => setToast(null)), [ownerId]);
  useEffect(()=>ownerId?draftStorage.subscribe?.(alertKey(ownerId),()=>{try{if(!inAppAlertsEnabled(ownerId))setToast(null);}catch{/* Keep the current preference when storage is unavailable. */}}):undefined,[ownerId]);
  useEffect(()=>{
    if(!ownerId)return;let active=true;let run:AbortController|null=null;let terminal=false;let batch:ReturnType<typeof setTimeout>|undefined;const scopes=new Set<string>();const cursorKey='lantern-events-v1-'+encodeURIComponent(ownerId);
    let cursor:number|null=null;try{const raw=draftStorage.read(cursorKey);const n=raw===null?NaN:Number(raw);if(Number.isSafeInteger(n)&&n>=0)cursor=n;}catch{/* Reconnect can safely start at the current server position. */}
    const refresh=(scope:string)=>{scopes.add(scope);if(batch)return;batch=setTimeout(()=>{batch=undefined;if(!active||!run||run.signal.aborted)return;for(const name of scopes)void cache.invalidateQueries({queryKey:[name,ownerId]});scopes.clear();},50);};
    const start=()=>{if(!active||terminal||run||AppState.currentState!=='active')return;const abort=new AbortController();run=abort;refresh('friends');refresh('letterbox');void(async()=>{let attempt=0;while(active&&!abort.signal.aborted&&!terminal){const url=new URL(env.apiUrl);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname=url.pathname.replace(/\/$/,'')+'/events/socket';url.search='';url.hash='';const channel=new PalaceLiveChannel(url.toString(),()=>getToken(),createSocket,abort.signal);try{await channel.listen(cursor,page=>{if(!active||abort.signal.aborted)return;attempt=0;setPalaceConnected(ownerId,true);if(page.reset){refresh('friends');refresh('letterbox');}for(const event of page.events){if(event.sequence<= (cursor??-1)&&!page.reset)continue;publishPalaceEvent(ownerId,event);if(event.kind.startsWith('FRIEND')||event.kind==='GATES_CHANGED')refresh('friends');if(event.kind.startsWith('LETTER')||event.kind==='GATES_CHANGED')refresh('letterbox');let alerts=true;try{alerts=inAppAlertsEnabled(ownerId);}catch{/* Default-on alerts keep arrival visible when preferences cannot be read. */}if(event.alert&&Date.now()-Date.parse(event.createdAt)<300000&&claimArrival(ownerId,event.id)&&alerts&&!(event.kind==='CHAT_RECEIVED'&&event.peerId===peer.current))setToast(event);}cursor=page.cursor;try{if(draftStorage.read(cursorKey)!==String(cursor))draftStorage.write(cursorKey,String(cursor));}catch{/* Keep the in-memory cursor while storage is unavailable. */}},()=>{terminal=true;try{closeLocalAccount(ownerId);}catch{/* The account session also checks server closure. */}});}catch{/* Reconnect with the saved cursor after connectivity returns. */}finally{channel.close();setPalaceConnected(ownerId,false);}await pause(abort.signal,Math.min(8000,500*2**attempt++));}})();};
    const stop=()=>{run?.abort();run=null;setPalaceConnected(ownerId,false);};start();const subscription=AppState.addEventListener('change',state=>{if(state==='active')start();else{stop();setToast(null);}});return()=>{active=false;stop();subscription.remove();clearTimeout(batch);};
  },[ownerId,getToken,cache,createSocket]);
  useEffect(()=>{if(!toast||modalOpen)return;const timeout=setTimeout(()=>setToast(null),8000);return()=>clearTimeout(timeout);},[toast,modalOpen]);
  if(!toast||modalOpen)return null;const copy=arrivalCopy(toast);
  return <View testID="palace-arrival-alert" accessibilityLiveRegion="polite" style={{position:'absolute',top:18,right:16,width:'92%',maxWidth:440,alignSelf:'center',zIndex:10000,padding:18,gap:12,borderWidth:2,borderColor:'#C2A165',borderTopLeftRadius:28,borderTopRightRadius:28,borderBottomLeftRadius:10,borderBottomRightRadius:10,backgroundColor:'#F7EDCF',boxShadow:'0px 7px 24px rgba(40,30,15,.25)'}}><View style={[{position:'absolute',inset:5,borderWidth:1,borderColor:'#D5BF89',borderRadius:19}, { pointerEvents: "none" }]} /><View style={{flexDirection:'row',gap:10,alignItems:'center'}}><PalaceCrest size={38}/><View style={{flex:1}}><Text style={s.dialogTitle}>{copy.title}</Text><Text style={s.body}>{copy.body}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Dismiss arrival alert" onPress={()=>setToast(null)} style={{padding:12}}><Text style={s.body}>×</Text></Pressable></View><RoyalNavButton label={copy.action} icon={toast.kind==='CHAT_RECEIVED'?'gate':'letter'} primary onPress={()=>{const target=eventDestination(toast);setToast(null);onOpen(target);}}/></View>;
}
