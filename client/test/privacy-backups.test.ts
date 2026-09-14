import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readArchive,readEnvelope } from '../src/backups/backup-contract';
import { assertPrivateWrite,closedAccountKey,privateKeyOwner } from '../src/account/local-privacy';
import { ChatSocketChannel } from '../src/chat/chat-socket';
import type { SocketPort } from '../src/chat/chat-socket';
test('a closed local account fences legacy letters, new documents, selection and chat without touching another account',()=>{
  const owner='owner-alice';const saved=new Map([[closedAccountKey(owner),'closed']]);const read=(key:string)=>saved.get(key)??null;
  for(const key of ['lantern-draft-v1-'+owner,'lantern-letter-v1-'+owner+'--'+randomUUID(),'lantern-letter-choice-v1-'+owner,'lantern-chat-v1-'+encodeURIComponent(JSON.stringify([owner,'owner-bob']))]){assert.equal(privateKeyOwner(key),owner);assert.throws(()=>assertPrivateWrite(key,read));}
  assert.doesNotThrow(()=>assertPrivateWrite('lantern-draft-v1-owner-bob',read));assert.doesNotThrow(()=>assertPrivateWrite(closedAccountKey(owner),read));
});
const archive=()=>({version:1,ownerKey:'account-key',createdAt:new Date().toISOString(),conversations:[{peerId:'owner-bob',username:'bob',through:2,messages:[{sequence:1,side:'mine',text:'Synthetic words',createdAt:new Date().toISOString()}]}]});
test('backup archive validates ownership, ordered messages, bounds and strips replay/receipt data',()=>{
  const value=archive();const result=readArchive({...value,pendingRequestId:randomUUID()},'account-key');assert.ok(!('pendingRequestId' in result));assert.throws(()=>readArchive(value,'different-account'));
  assert.throws(()=>readArchive({...value,conversations:[value.conversations[0],value.conversations[0]]},'account-key'));
  value.conversations[0]!.messages.push({...value.conversations[0]!.messages[0]!});assert.throws(()=>readArchive(value,'account-key'));
  assert.throws(()=>readEnvelope({text:'plaintext must not be uploaded'}));assert.throws(()=>readEnvelope({format:'lantern-chat-backup',version:1,algorithm:'AES-256-GCM',data:'A'.repeat(14*1024*1024+1)}));
});
class Socket implements SocketPort {
  readyState=1;onopen:(()=>void)|null=null;onmessage:((e:{data:unknown})=>void)|null=null;onerror:(()=>void)|null=null;onclose:(()=>void)|null=null;sent:string[]=[];closed=false;
  send(s:string){this.sent.push(s);}close(){this.closed=true;}
}
test('socket waits for credentials, never puts them in URL, and abort prevents late subscription',async()=>{
  const abort=new AbortController();let finish!:(token:string)=>void;let created=0;
  const channel=new ChatSocketChannel('owner-bob',0,'wss://example.invalid/chat/socket',()=>new Promise(resolve=>{finish=resolve;}),()=>{created++;return new Socket();},abort.signal);
  const start=channel.start();abort.abort();finish('private-bearer');await start;assert.equal(created,0);assert.equal(channel.closed,true);await assert.rejects(channel.next());
});
test('socket delivers validated pages, rejects wrong peers and drops buffered content on closure',async()=>{
  const socket=new Socket();const abort=new AbortController();const channel=new ChatSocketChannel('owner-bob',3,'wss://example.invalid/chat/socket',async()=>'private-bearer',url=>{assert.ok(!url.includes('private-bearer'));return socket;},abort.signal);
  await channel.start();socket.onopen?.();assert.equal(JSON.parse(socket.sent[0]!).after,3);
  const page={peer:{id:'owner-bob',username:'bob',character:null},messages:[],cursor:3,before:null};socket.onmessage?.({data:JSON.stringify({type:'page',page})});assert.equal((await channel.next()).cursor,3);
  const waiting=channel.next();socket.onmessage?.({data:JSON.stringify({type:'page',page:{...page,peer:{...page.peer,id:'other-owner'}}})});await assert.rejects(waiting);assert.equal(socket.closed,true);assert.equal(channel.closed,true);
});
