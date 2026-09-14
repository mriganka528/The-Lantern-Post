import assert from 'node:assert/strict';
import { after,before,beforeEach,test } from 'node:test';
import { randomUUID } from 'node:crypto';
import WebSocket from 'ws';
import { createFriendsTestApp } from './friends-fixture';
import { PalaceEvents } from '../src/realtime/palace-events';
import type { PalaceEventPage,DeliveryReceipt,ChatReceipt } from '@lantern-post/shared-types';
let context:Awaited<ReturnType<typeof createFriendsTestApp>>;
before(async()=>{context=await createFriendsTestApp(true,undefined,undefined,'disabled');});beforeEach(()=>{context.fixture.reset();context.fixture.state.requests.push({id:'friendship',fromUserId:'owner-alice',toUserId:'owner-bob',status:'ACCEPTED',createdAt:new Date()});});after(async()=>context.app.close());
const request=(path:string,owner='alice',body?:unknown)=>fetch(context.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+owner,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const letter=()=>({requestId:randomUUID(),type:'TEXT',destinationType:'FRIEND',recipientId:'owner-bob',presetId:'preset_lantern',textContent:'SYNTHETIC_PRIVATE_LIVE_LETTER',deliveryConfirmed:true});
async function send(){const response=await request('/letters','alice',letter());assert.equal(response.status,200);return response.json() as Promise<DeliveryReceipt>;}
async function socket(owner='bob',after:number|null=null){const ws=new WebSocket(context.url.replace('http:','ws:')+'/events/socket');const pages:PalaceEventPage[]=[];ws.on('message',raw=>{const frame=JSON.parse(raw.toString()) as {type:string;page:PalaceEventPage};if(frame.type==='events')pages.push(frame.page);});await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'subscribe',token:owner,after}));await until(()=>pages.length>0);return {ws,pages};}
async function until(check:()=>boolean){const end=Date.now()+5000;while(!check()){if(Date.now()>end)throw Error('Timed out waiting for a live event.');await new Promise(resolve=>setTimeout(resolve,15));}}
test('account sockets deliver private arrival metadata after commit without leaking words or echoing sender alerts',async()=>{
  const bob=await socket();const alice=await socket('alice');try{assert.equal(bob.pages[0]?.reset,true);const receipt=await send();await until(()=>bob.pages.some(p=>p.events.some(e=>e.kind==='LETTER_RECEIVED')));const event=bob.pages.flatMap(p=>p.events).find(e=>e.kind==='LETTER_RECEIVED')!;assert.equal(event.itemId,receipt.letterId);assert.equal(event.alert,true);assert.ok(!JSON.stringify(bob.pages).includes('SYNTHETIC_PRIVATE'));await until(()=>alice.pages.some(p=>p.events.length>0));assert.ok(alice.pages.flatMap(p=>p.events).every(e=>!e.alert));
    const cursor=bob.pages.at(-1)!.cursor;bob.ws.close();const next=await send();const resumed=await socket('bob',cursor);try{assert.ok(resumed.pages.flatMap(p=>p.events).some(e=>e.itemId===next.letterId));}finally{resumed.ws.close();}
  }finally{bob.ws.close();alice.ws.close();}
});
test('each side can remove its own letter without affecting the other, and concurrent final deletion purges content',async()=>{
  const receipt=await send();const remove=(owner:string)=>request('/letters/friends/'+receipt.letterId+'/delete',owner,{});const open=(owner:string)=>request('/letters/friends/'+receipt.letterId+'/open',owner,{});
  assert.equal((await remove('alice')).status,200);assert.equal((await open('alice')).status,404);assert.equal((await open('bob')).status,200);assert.equal(context.fixture.state.letters[0]?.textContent,'SYNTHETIC_PRIVATE_LIVE_LETTER');assert.equal((await remove('alice')).status,200);assert.equal((await remove('carol')).status,404);assert.equal((await remove('bob')).status,200);assert.equal(context.fixture.state.letters[0]?.textContent,null);
  const second=await send();const both=await Promise.all(['alice','bob'].map(owner=>request('/letters/friends/'+second.letterId+'/delete',owner,{})));assert.ok(both.every(r=>r.status===200));assert.equal(context.fixture.state.letters.find(l=>l.id===second.letterId)?.status,'HARD_DELETED');
});
test('deleted or blocked arrivals cannot generate fresh receiver alerts and feed cursors are owner-scoped',async()=>{
  const receipt=await send();await request('/letters/friends/'+receipt.letterId+'/delete','bob',{});const events=context.app.get(PalaceEvents);const page=await events.read('owner-bob',0);assert.ok(page.events.every(e=>!e.alert));assert.equal((await events.read('owner-carol',0)).events.length,0);
  await request('/chat/owner-bob/messages','alice',{requestId:randomUUID(),text:'PRIVATE_CHAT_WORDS',confirmed:true});await request('/safety/blocks/owner-alice','bob',{confirmed:true});const blocked=await events.read('owner-bob',0);assert.ok(blocked.events.every(e=>!e.alert));assert.ok(!JSON.stringify(blocked).includes('PRIVATE_CHAT_WORDS'));
});
test('a notification outbox failure rolls back the message and every live event',async()=>{
  context.fixture.state.failJob=true;assert.equal((await request('/chat/owner-bob/messages','alice',{requestId:randomUUID(),text:'Do not publish this failed send.',confirmed:true})).status,503);assert.equal(context.fixture.state.chatMessages.length,0);assert.equal(context.fixture.state.events.length,0);assert.equal(context.fixture.state.users[0]?.realtimeSequence,0);
});

test('bell history includes offline arrivals, isolates owners, and never exposes private content', async () => {
  const receipt = await send();
  await request('/chat/owner-bob/messages', 'alice', { requestId: randomUUID(), text: 'PRIVATE_BELL_MESSAGE', confirmed: true });
  for (const event of context.fixture.state.events) event.createdAt = new Date(Date.now() - 3600000);
  const response = await request('/notifications/inbox', 'bob'); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const page = await response.json() as PalaceEventPage;
  assert.deepEqual(page.events.map(event => event.kind), ['LETTER_RECEIVED', 'CHAT_RECEIVED']);
  assert.ok(page.events.every(event => event.alert));
  assert.ok(!JSON.stringify(page).includes('PRIVATE_BELL_MESSAGE')); assert.ok(!JSON.stringify(page).includes('SYNTHETIC_PRIVATE_LIVE_LETTER'));
  assert.equal(((await (await request('/notifications/inbox', 'carol')).json()) as PalaceEventPage).events.length, 0);
  assert.equal(((await (await request('/notifications/inbox', 'alice')).json()) as PalaceEventPage).events.length, 0);
  assert.equal((await fetch(context.url + '/notifications/inbox')).status, 401);
  await request('/letters/friends/' + receipt.letterId + '/open', 'bob', {});
  const opened = await (await request('/notifications/inbox', 'bob')).json() as PalaceEventPage;
  assert.equal(opened.events.find(event => event.itemId === receipt.letterId)?.alert, false);
});

test('bell history respects independent deletion, closed gates and seven-day expiry', async () => {
  const receipt = await send();
  const inbox = async () => (await (await request('/notifications/inbox', 'bob')).json()) as PalaceEventPage;
  await request('/letters/friends/' + receipt.letterId + '/delete', 'alice', {});
  assert.equal((await inbox()).events.length, 1);
  await request('/letters/friends/' + receipt.letterId + '/delete', 'bob', {});
  assert.equal((await inbox()).events.length, 0);
  await request('/chat/owner-bob/messages', 'alice', { requestId: randomUUID(), text: 'Visible until the gate closes', confirmed: true });
  assert.equal((await inbox()).events.length, 1);
  await request('/safety/blocks/owner-alice', 'bob', { confirmed: true });
  assert.equal((await inbox()).events.length, 0);
  context.fixture.reset(); context.fixture.state.requests.push({ id: 'friendship', fromUserId: 'owner-alice', toUserId: 'owner-bob', status: 'ACCEPTED', createdAt: new Date() });
  await send(); for (const event of context.fixture.state.events) event.createdAt = new Date(Date.now() - 8 * 86400000);
  assert.equal((await inbox()).events.length, 0);
});

test('bell history limits its response to the latest fifty notices', async () => {
  await send(); const event = context.fixture.state.events.find(row => row.ownerId === 'owner-bob')!;
  for (let i = 2; i <= 120; i++) context.fixture.state.events.push({ ...event, id: 'bounded-bell-' + i, sequence: i });
  context.fixture.state.users.find(row => row.id === 'owner-bob')!.realtimeSequence = 120;
  const page = await (await request('/notifications/inbox', 'bob')).json() as PalaceEventPage;
  assert.equal(page.events.length, 50); assert.equal(page.events[0]?.sequence, 71); assert.equal(page.events.at(-1)?.sequence, 120);
});
test('chat phone push is generic and routed to the recipient; closed gates suppress delivery',async()=>{
  await request('/notifications/register','bob',{token:'ExpoPushToken[fixture-live-chat]',platform:'android'});const response=await request('/chat/owner-bob/messages','alice',{requestId:randomUUID(),text:'DO_NOT_INCLUDE_IN_PUSH',confirmed:true});const receipt=await response.json() as ChatReceipt;const calls:Record<string,unknown>[]=[];const original=globalThis.fetch;
  globalThis.fetch=(async(url,options)=>{if(String(url)!=='https://exp.host/--/api/v2/push/send')return original(url,options);calls.push(...JSON.parse(String(options?.body)) as Record<string,unknown>[]);return Response.json({data:[{status:'ok',id:'push-fixture'}]});}) as typeof fetch;
  try{await context.notifications.dispatch();assert.equal(calls.length,1);const data=calls[0]!.data as Record<string,unknown>;assert.equal(data.screen,'chat');assert.equal(data.ownerId,'owner-bob');assert.equal(data.peerId,'owner-alice');assert.equal(data.messageId,receipt.messageId);assert.ok(!JSON.stringify(calls).includes('DO_NOT_INCLUDE_IN_PUSH'));context.fixture.state.jobs[0]!.completedAt=null;await request('/safety/blocks/owner-alice','bob',{confirmed:true});await context.notifications.dispatch();assert.equal(calls.length,1);}finally{globalThis.fetch=original;}
});
