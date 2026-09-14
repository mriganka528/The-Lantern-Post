import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after,before,beforeEach,test } from 'node:test';
import { randomBytes,randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { createFriendsTestApp,friendsFixture } from './friends-fixture';
import { AccountService } from '../src/account/account.service';
import { IdentityRemoval } from '../src/account/identity-removal';
import { LetterModerationService } from '../src/letters/letter-moderation.service';
import { AccountAccess } from '../src/account/account-access';
import { UsersService } from '../src/users/users.service';
import type { PrismaService } from '../src/database/prisma.service';
import { DriveService,backupOwnerKey } from '../src/backups/drive.service';
import type { Environment } from '../src/config/environment';
import { validateEnvironment } from '../src/config/environment';
let harness:Awaited<ReturnType<typeof createFriendsTestApp>>;
before(async()=>{harness=await createFriendsTestApp(false,{available:true,check:async()=> 'APPROVED'});});
beforeEach(()=>harness.fixture.reset());after(async()=>harness.app.close());
const request=(path:string,subject='alice',body?:unknown)=>fetch(harness.url+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+subject,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const friends=()=>harness.fixture.state.requests.push({id:'friend',fromUserId:'owner-alice',toUserId:'owner-bob',status:'ACCEPTED',createdAt:new Date()});
const message=(text='A synthetic greeting')=>request('/chat/owner-bob/messages','alice',{requestId:randomUUID(),text,confirmed:true});
test('deletion requires authentication and exact confirmation; it never accepts a caller-selected owner',async()=>{
  const input={requestId:randomUUID(),confirmation:'alice',confirmed:true};
  assert.equal((await request('/account/delete','forged',input)).status,401);
  assert.equal((await request('/account/delete','alice',{...input,ownerId:'owner-bob'})).status,400);
  assert.equal((await request('/account/delete','alice',{...input,confirmation:'bob'})).status,400);
  assert.equal(harness.fixture.state.deletions.length,0);
});
test('account removal erases both sides of chat, closes access, preserves receipts and cannot recreate a profile',async()=>{
  friends();assert.equal((await message()).status,200);const receipt=harness.fixture.state.chatReceipts[0];
  const response=await request('/account/delete','alice',{requestId:randomUUID(),confirmation:'alice',confirmed:true});assert.equal(response.status,200);
  assert.equal(harness.fixture.state.chatMessages[0]?.text,'');assert.ok(harness.fixture.state.chatMessages[0]?.erasedAt);assert.equal(harness.fixture.state.chatReceipts[0]?.id,receipt?.id);
  assert.equal((await request('/chat/owner-alice','bob')).status,404);assert.equal((await request('/chat/owner-bob')).status,410);
  const db=harness.fixture.database as unknown as PrismaService;await assert.rejects(new UsersService(db).createProfile('alice','alice'));
  const replay=await request('/account/delete','alice',{requestId:randomUUID(),confirmation:'alice',confirmed:true});assert.equal(replay.status,200);assert.equal(harness.fixture.state.deletions.length,1);
  await harness.app.get(AccountService).sweep();assert.equal(harness.fixture.state.deletions[0]?.state,'COMPLETE');assert.equal(harness.fixture.state.users.find(u=>u.id==='owner-alice')?.accountState,'DELETED');
  await assert.rejects(new AccountAccess(db).assertSubject('alice'));assert.equal(harness.fixture.state.users.find(u=>u.id==='owner-bob')?.username,'bob');
});
test('external deletion failure stays pending and retries without restoring readable content',async()=>{
  const identity=harness.app.get(IdentityRemoval);const original=identity.remove;identity.remove=async()=>{throw Error('isolated provider failure');};
  try {await request('/account/delete','alice',{requestId:randomUUID(),confirmation:'alice',confirmed:true});await harness.app.get(AccountService).sweep();assert.equal(harness.fixture.state.deletions[0]?.state,'PENDING');assert.equal(harness.fixture.state.deletions[0]?.errorCode,'IDENTITY_CLEANUP_PENDING');}
  finally {identity.remove=original;}
  harness.fixture.state.deletions[0]!.availableAt=new Date(0);await harness.app.get(AccountService).sweep();assert.equal(harness.fixture.state.deletions[0]?.state,'COMPLETE');
});
test('deleting during held moderation prevents the delayed message from being committed',async()=>{
  friends();const provider=harness.app.get(LetterModerationService);const original=provider.check;let release!:(value:'APPROVED')=>void;let started!:()=>void;const checking=new Promise<void>(resolve=>{started=resolve;});
  provider.check=()=>{started();return new Promise(resolve=>{release=resolve;});};
  try{const pending=message('Must never arrive after account deletion.');await checking;await request('/account/delete','alice',{requestId:randomUUID(),confirmation:'alice',confirmed:true});release('APPROVED');assert.equal((await pending).status,410);assert.equal(harness.fixture.state.chatMessages.length,0);}finally{provider.check=original;}
});
test('a failed deletion transaction retains the original account and message',async()=>{
  friends();await message();const model=harness.fixture.database.chatReport;const original=model.updateMany;model.updateMany=async()=>{throw Error('Synthetic storage failure');};
  try{assert.equal((await request('/account/delete','alice',{requestId:randomUUID(),confirmation:'alice',confirmed:true})).status,503);assert.equal(harness.fixture.state.users[0]?.accountState,'ACTIVE');assert.equal(harness.fixture.state.chatMessages[0]?.text,'A synthetic greeting');assert.equal(harness.fixture.state.deletions.length,0);}finally{model.updateMany=original;}
});
test('backup manifest/pages contain approved conversations only and close after a block',async()=>{
  friends();await message();const manifest=await(await request('/backups/manifest')).json() as {ownerKey:string;conversations:{peerId:string;through:number}[]};assert.equal(manifest.ownerKey,backupOwnerKey('owner-alice'));assert.equal(manifest.conversations.length,1);
  const page=await(await request('/backups/page?peerId=owner-bob&through=1&before=100')).json();assert.ok(JSON.stringify(page).includes('A synthetic greeting'));assert.ok(!JSON.stringify(page).includes('owner-alice'));
  harness.fixture.state.blocks.push({id:'block',blockerId:'owner-bob',blockedId:'owner-alice'});assert.equal((await request('/backups/page?peerId=owner-bob&through=1&before=100')).status,404);
  assert.equal((await request('/backups/manifest','carol')).status,200);
});
test('socket authenticates its first frame, resumes by cursor and closes when a friendship closes',async()=>{
  friends();await message();const ws=new WebSocket(harness.url.replace('http:','ws:')+'/chat/socket',{origin:'http://localhost:8081'});
  const frames:Record<string,unknown>[]=[];ws.on('message',raw=>frames.push(JSON.parse(raw.toString()) as Record<string,unknown>));
  await new Promise<void>((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});ws.send(JSON.stringify({type:'subscribe',token:'alice',peerId:'owner-bob',after:0}));
  await until(()=>frames.length>0);assert.equal(frames[0]?.type,'page');assert.ok(JSON.stringify(frames).includes('A synthetic greeting'));
  await message('The next post');await until(()=>JSON.stringify(frames).includes('The next post'));
  const closed=new Promise<void>(resolve=>ws.once('close',()=>resolve()));harness.fixture.state.blocks.push({id:'block',blockerId:'owner-bob',blockedId:'owner-alice'});await closed;assert.ok(frames.some(f=>f.type==='closed'));
});
test('socket rejects untrusted origins, URL credentials and forged subscriptions',async()=>{
  for(const [path,origin] of [['/chat/socket','https://untrusted.invalid'],['/chat/socket?token=alice','http://localhost:8081']]){const ws=new WebSocket(harness.url.replace('http:','ws:')+path,{origin});await new Promise<void>(resolve=>ws.once('error',()=>resolve()));ws.terminate();}
  const ws=new WebSocket(harness.url.replace('http:','ws:')+'/chat/socket');await new Promise<void>(resolve=>ws.once('open',resolve));const ended=new Promise<void>(resolve=>ws.once('close',()=>resolve()));ws.send(JSON.stringify({type:'subscribe',token:'forged',peerId:'owner-bob',after:0}));await ended;
});
async function until(check:()=>boolean){const end=Date.now()+4000;while(!check()){if(Date.now()>end)throw Error('Timed out');await new Promise(resolve=>setTimeout(resolve,20));}}

class FakeDrive extends DriveService {
  calls:{url:string;options:RequestInit}[]=[];savedFiles:{id:string;name:string;modifiedTime:string;size:string}[]=[];backup:unknown;
  protected async request(url:string,options:RequestInit={}) {this.calls.push({url,options});let body:unknown={};
    if(url==='https://oauth2.googleapis.com/token')body={refresh_token:'fixture-refresh-secret',access_token:'fixture-access',scope:'https://www.googleapis.com/auth/drive.appdata'};
    else if(url.includes('uploadType=multipart')){const id='drive_fixture';this.savedFiles.push({id,name:'backup',modifiedTime:new Date().toISOString(),size:'200'});body={id};}
    else if(url.includes('alt=media'))body=this.backup;
    else if(url.startsWith('https://www.googleapis.com/drive/v3/files?'))body={files:this.savedFiles};
    else if(options.method==='DELETE')this.savedFiles=[];
    return new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
  }
}
test('Drive uses one-use PKCE state, encrypted credentials and only owner-scoped encrypted backups',async()=>{
  const f=friendsFixture();const config=new ConfigService<Environment,true>(validateEnvironment({NODE_ENV:'test',DATABASE_URL:'postgresql://localhost/test',GOOGLE_DRIVE_CLIENT_ID:'fixture-id',GOOGLE_DRIVE_CLIENT_SECRET:'fixture-secret',GOOGLE_DRIVE_REDIRECT_URI:'http://localhost:3000/backups/drive/callback',GOOGLE_DRIVE_TOKEN_KEY:randomBytes(32).toString('base64')}));const drive=new FakeDrive(f.database as unknown as PrismaService,config);
  const link=await drive.begin('alice');const url=new URL(link.authorizationUrl);assert.equal(url.searchParams.get('scope'),'https://www.googleapis.com/auth/drive.appdata');assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(!JSON.stringify(f.state.driveLinks).includes(url.searchParams.get('state')!));
  await assert.rejects(drive.linkStatus('bob',link.id));await drive.callback(url.searchParams.get('state')!,'fixture-code');assert.ok(!JSON.stringify(f.state.driveConnections).includes('fixture-refresh-secret'));await assert.rejects(drive.callback(url.searchParams.get('state')!,'fixture-code'));
  await assert.rejects(drive.upload('alice',{text:'must never be accepted'}));const envelope={format:'lantern-chat-backup',version:1,algorithm:'AES-256-GCM',data:randomBytes(80).toString('base64')};await drive.upload('alice',envelope);drive.backup=envelope;assert.deepEqual(await drive.download('alice','drive_fixture'),envelope);await assert.rejects(drive.download('bob','drive_fixture'));
  assert.ok(drive.calls.some(c=>String(c.options.body).includes('appDataFolder')));await drive.eraseOwner('owner-alice');assert.equal(f.state.driveConnections.length,0);assert.equal(drive.savedFiles.length,0);
});

test('the completed Drive callback offers a fixed app return link without reflecting OAuth credentials', async () => {
  const drive = harness.app.get(DriveService); const callback = drive.callback;
  drive.callback = async () => {};
  try {
    const response = await fetch(harness.url + '/backups/drive/callback?state=PRIVATE_STATE&code=PRIVATE_CODE&returnTo=https://outside.invalid');
    const html = await response.text(); assert.equal(response.status, 200);
    assert.ok(html.includes('href="lantern-post://privacy"')); assert.ok(!/PRIVATE_STATE|PRIVATE_CODE|outside\.invalid/.test(html));
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  } finally { drive.callback = callback; }
});
