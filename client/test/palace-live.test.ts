import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPalaceEvents,eventDestination } from '../src/realtime/palace-live-contract';
import { PalaceLiveChannel } from '../src/realtime/palace-live-channel';
import type { SocketPort } from '../src/chat/chat-socket';
import { notificationDestination } from '../src/notifications/notification-contract';
const event={id:'arrival-1',sequence:1,kind:'CHAT_RECEIVED',peerId:'owner-alice',itemId:'chatmsg_00000000-0000-4000-8000-000000000001',createdAt:new Date().toISOString(),alert:true};
test('live event pages validate ordering, bounded metadata and navigation without accepting content',()=>{
  const page=readPalaceEvents({events:[{...event,text:'not part of a feed'}],cursor:1,reset:false});assert.ok(!JSON.stringify(page).includes('not part'));assert.deepEqual(eventDestination(page.events[0]!),{screen:'chat',peerId:'owner-alice'});assert.throws(()=>readPalaceEvents({events:[event,event],cursor:1,reset:false}));assert.throws(()=>readPalaceEvents({events:[{...event,peerId:'https://outside.invalid'}],cursor:1,reset:false}));
});
test('native chat notifications must address the current owner and a valid chat destination',()=>{
  const payload={ownerId:'owner-bob',type:'CHAT_MESSAGE',screen:'chat',eventId:event.id,peerId:'owner-alice',messageId:event.itemId};assert.deepEqual(notificationDestination(payload,'owner-bob'),{eventId:event.id,screen:'chat',peerId:'owner-alice'});assert.equal(notificationDestination(payload,'owner-carol'),null);assert.equal(notificationDestination({...payload,peerId:'//bad'},'owner-bob'),null);
});
test('closing a live feed while credentials load prevents a late socket connection',async()=>{
  const abort=new AbortController();let finish!:(value:string)=>void;let connections=0;const channel=new PalaceLiveChannel('wss://example.invalid/events/socket',()=>new Promise(resolve=>{finish=resolve;}),()=>{connections++;throw Error();},abort.signal);const listening=channel.listen(null,()=>{},()=>{});abort.abort();finish('private-token');await listening;assert.equal(connections,0);
});
test('live socket credentials stay in the first frame and abort detaches later callbacks',async()=>{
  const port:SocketPort={readyState:1,onopen:null,onmessage:null,onclose:null,onerror:null,send:()=>{},close:()=>{}};let frame='';port.send=value=>{frame=value;};const abort=new AbortController();let pages=0;const channel=new PalaceLiveChannel('wss://example.invalid/events/socket',async()=> 'private-token',url=>{assert.ok(!url.includes('private-token'));return port;},abort.signal);const listening=channel.listen(4,()=>{pages++;},()=>{});await Promise.resolve();port.onopen?.();assert.deepEqual(JSON.parse(frame),{type:'subscribe',token:'private-token',after:4});port.onmessage?.({data:JSON.stringify({type:'events',page:{events:[],cursor:4,reset:false}})});assert.equal(pages,1);abort.abort();await listening;assert.equal(port.onmessage,null);
});
