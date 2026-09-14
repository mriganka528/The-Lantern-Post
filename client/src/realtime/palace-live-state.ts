import { useEffect,useSyncExternalStore } from 'react';
import type { PalaceLiveEvent } from '@lantern-post/shared-types';
const connected=new Set<string>();const listeners=new Set<()=>void>();const observers=new Map<string,Set<(event:PalaceLiveEvent)=>void>>();const arrivals=new Set<string>();
const dismissals = new Map<string, Set<() => void>>();
export function dismissPalaceArrival(ownerId: string) { dismissals.get(ownerId)?.forEach(listener => listener()); }
export function watchArrivalDismissal(ownerId: string, listener: () => void) { const set = dismissals.get(ownerId) ?? new Set(); set.add(listener); dismissals.set(ownerId, set); return () => { set.delete(listener); if (!set.size) dismissals.delete(ownerId); }; }
let modals=0;const modalListeners=new Set<()=>void>();
export function useBlockingPalaceModal(){useEffect(()=>{modals++;modalListeners.forEach(fn=>fn());return()=>{modals=Math.max(0,modals-1);modalListeners.forEach(fn=>fn());};},[]);}
export function usePalaceModalOpen(){return useSyncExternalStore(fn=>{modalListeners.add(fn);return()=>modalListeners.delete(fn);},()=>modals>0,()=>false);}
export function palaceConnected(ownerId:string){return connected.has(ownerId);}
export function setPalaceConnected(ownerId:string,value:boolean){if(value)connected.add(ownerId);else connected.delete(ownerId);listeners.forEach(listener=>listener());}
export function usePalaceConnection(ownerId:string){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>listeners.delete(listener);},()=>palaceConnected(ownerId),()=>false);}
export function claimArrival(ownerId:string,id:string){const key=ownerId+':'+id;if(arrivals.has(key))return false;arrivals.add(key);if(arrivals.size>512)arrivals.delete(arrivals.values().next().value!);return true;}
export function publishPalaceEvent(ownerId:string,event:PalaceLiveEvent){observers.get(ownerId)?.forEach(listener=>listener(event));}
export function watchPalaceEvents(ownerId:string,listener:(event:PalaceLiveEvent)=>void){const set=observers.get(ownerId)??new Set();set.add(listener);observers.set(ownerId,set);return()=>{set.delete(listener);if(!set.size)observers.delete(ownerId);};}
