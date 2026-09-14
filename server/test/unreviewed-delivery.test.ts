import assert from 'node:assert/strict';
import { after,before,beforeEach,test } from 'node:test';
import { createHash,randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import type { DeliveryReceipt,ChatReceipt,WorldReceipt,VoiceUploadGrant,DeliveryCapabilities,ChatCapabilities,WorldCapabilities,ChatPage,WorldLetter } from '@lantern-post/shared-types';
import { createFriendsTestApp } from './friends-fixture';
import { memoryVoiceStorage,syntheticWebm } from './voice-fixture';
import { LetterModerationService } from '../src/letters/letter-moderation.service';
import { combinedReview } from '../src/letters/content-review';
let context:Awaited<ReturnType<typeof createFriendsTestApp>>;
const media=memoryVoiceStorage();
before(async()=>{context=await createFriendsTestApp(false,undefined,media.storage,'disabled');});
beforeEach(()=>{context.fixture.reset();media.objects.clear();media.setEnabled(true);context.app.get(ConfigService).set('MODERATION_MODE','disabled');context.fixture.state.requests.push({id:'friendship',fromUserId:'owner-alice',toUserId:'owner-bob',status:'ACCEPTED',createdAt:new Date()});});
after(async()=>context.app.close());
const request=(path:string,who='alice',body?:unknown)=>fetch(context.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+who,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const letter=()=>({requestId:randomUUID(),type:'TEXT',destinationType:'FRIEND',recipientId:'owner-bob',presetId:'preset_lantern',textContent:'A real letter without an automated check.',deliveryConfirmed:true});
const publicLetter=()=>({requestId:randomUUID(),type:'TEXT',destinationType:'INFINITY',presetId:'preset_lantern',textContent:'A light sent without automated moderation.',publicConfirmed:true,isSigned:false});
test('the real disabled service enables text and voice without provider credentials or fabricated approval',async()=>{
  const service=context.app.get(LetterModerationService);assert.equal(await service.check('Synthetic words'),'NOT_REQUIRED');assert.equal(await service.checkVoice({bytes:syntheticWebm(),mimeType:'audio/webm',durationMs:2000}),'NOT_REQUIRED');
  const friend=await(await request('/letters/friends/capabilities')).json() as DeliveryCapabilities;assert.equal(friend.textAvailable,true);assert.equal(friend.voiceAvailable,true);
  assert.equal((await(await request('/chat/capabilities')).json() as ChatCapabilities).textAvailable,true);assert.equal((await(await request('/infinity/capabilities')).json() as WorldCapabilities).voiceAvailable,true);
});
test('unreviewed chat is delivered once, readable and included in chat backups',async()=>{
  const input={requestId:randomUUID(),text:'Words between friends.',confirmed:true};const sent=await request('/chat/owner-bob/messages','alice',input);assert.equal(sent.status,200);const receipt=await sent.json() as ChatReceipt;assert.equal(receipt.outcome,'DELIVERED');
  assert.deepEqual(await(await request('/chat/owner-bob/messages','alice',input)).json(),receipt);assert.equal(context.fixture.state.chatMessages.length,1);const row=context.fixture.state.chatMessages[0]!;assert.equal(row.moderationPassed,null);assert.equal(row.moderationSkipped,true);
  const page=await(await request('/chat/owner-alice','bob')).json() as ChatPage;assert.equal(page.messages[0]!.text,input.text);assert.ok(!JSON.stringify(page).includes('moderationSkipped'));
  const backup=await(await request('/backups/page?peerId=owner-bob&through=1&before=2')).json() as ChatPage;assert.equal(backup.messages[0]!.text,input.text);
});
test('private letters and reports work without automated moderation while strangers stay excluded',async()=>{
  const input=letter();const sent=await request('/letters','alice',input);assert.equal(sent.status,200);const receipt=await sent.json() as DeliveryReceipt;assert.equal(receipt.outcome,'DELIVERED');
  const row=context.fixture.state.letters[0]!;assert.equal(row.moderationPassed,null);assert.equal(row.moderationSkipped,true);assert.equal(row.moderationCheckedAt,null);
  assert.equal((await request('/letters/friends/'+receipt.letterId+'/open','bob',{})).status,200);assert.equal((await request('/letters/friends/'+receipt.letterId+'/open','carol',{})).status,404);
  assert.equal((await request('/safety/letters/'+receipt.letterId+'/report','bob',{reason:'SPAM',confirmed:true,blockSender:false})).status,200);
  assert.equal(context.fixture.state.reports.length,1);assert.equal(context.fixture.state.jobs.length,1);
});
test('public stars remain unsigned and support reports and anonymous blocks without moderation',async()=>{
  const sent=await request('/letters','alice',publicLetter());assert.equal(sent.status,200);const receipt=await sent.json() as WorldReceipt;assert.equal(receipt.outcome,'DELIVERED');
  const opened=await request('/infinity/stars/'+receipt.letterId+'/open','bob',{});assert.equal(opened.status,200);const content=await opened.json() as WorldLetter;assert.equal(content.signature,null);assert.ok(!JSON.stringify(content).includes('owner-alice'));
  const report=await request('/safety/letters/'+receipt.letterId+'/report','bob',{reason:'SPAM',confirmed:true,blockSender:true});assert.equal(report.status,200);
  assert.equal((await request('/infinity/stars/'+receipt.letterId+'/open','bob',{})).status,404);assert.equal(context.fixture.state.blocks.length,1);
});
test('validated voice letters and captions deliver to friends and the world without a content provider',async()=>{
  for(const destinationType of ['FRIEND','INFINITY']){
    const bytes=syntheticWebm();const requestId=randomUUID();const upload={requestId,mimeType:'audio/webm',byteLength:bytes.length,durationMs:2000,sha256:createHash('sha256').update(bytes).digest('base64'),...(destinationType==='FRIEND'?{recipientId:'owner-bob'}:{destinationType:'INFINITY'})};
    const grant=await(await request('/voice/uploads','alice',upload)).json() as VoiceUploadGrant;media.objects.set('voice/incoming/'+grant.assetId,bytes);assert.equal((await request('/voice/uploads/'+grant.assetId+'/finish','alice',{})).status,200);
    const result=await request('/letters','alice',{requestId,type:'VOICE',destinationType,presetId:'preset_lantern',voiceAssetId:grant.assetId,voiceCaption:'A caption sent with the recording.',...(destinationType==='FRIEND'?{recipientId:'owner-bob',deliveryConfirmed:true}:{publicConfirmed:true,isSigned:false})});assert.equal(result.status,200);assert.equal((await result.json() as DeliveryReceipt).outcome,'DELIVERED');
  }
  assert.equal(context.fixture.state.letters.length,2);for(const row of context.fixture.state.letters){assert.equal(row.moderationPassed,null);assert.equal(row.moderationSkipped,true);assert.equal(row.voiceCaption,'A caption sent with the recording.');assert.equal(row.moderationCheckedAt,null);}
});
test('disabled content checks do not disable confirmation, upload integrity, blocks, limits or cancellation',async()=>{
  assert.equal((await request('/letters','alice',{...letter(),deliveryConfirmed:false})).status,400);assert.equal((await request('/letters','alice',{...letter(),moderationSkipped:true})).status,400);
  const cancelled=letter();assert.equal((await request('/letters/friends/requests/'+cancelled.requestId+'/cancel','alice',{recipientId:'owner-bob'})).status,200);assert.equal((await(await request('/letters','alice',cancelled)).json() as DeliveryReceipt).reason,'CANCELLED');
  context.fixture.state.blocks.push({id:'blocked',blockerId:'owner-bob',blockedId:'owner-alice'});assert.equal((await(await request('/letters','alice',letter())).json() as DeliveryReceipt).reason,'FRIEND_UNAVAILABLE');
  assert.equal(context.fixture.state.letters.length,0);assert.equal((await request('/chat/owner-bob')).status,404);
  context.fixture.state.blocks=[];const bytes=syntheticWebm();const body={requestId:randomUUID(),mimeType:'audio/webm',byteLength:bytes.length,durationMs:2000,sha256:createHash('sha256').update(bytes).digest('base64'),recipientId:'owner-bob'};const grant=await(await request('/voice/uploads','alice',body)).json() as VoiceUploadGrant;media.objects.set('voice/incoming/'+grant.assetId,Buffer.alloc(bytes.length));assert.equal((await request('/voice/uploads/'+grant.assetId+'/finish','alice',{})).status,409);
});
test('required mode remains unavailable for a later provider and does not reinterpret saved unreviewed messages',async()=>{
  await request('/chat/owner-bob/messages','alice',{requestId:randomUUID(),text:'Saved before the later update.',confirmed:true});context.app.get(ConfigService).set('MODERATION_MODE','required');assert.equal((await(await request('/chat/capabilities')).json() as ChatCapabilities).textAvailable,false);assert.equal((await request('/chat/owner-bob/messages','alice',{requestId:randomUUID(),text:'Must wait for a configured provider.',confirmed:true})).status,503);
  assert.equal((await(await request('/chat/owner-alice','bob')).json() as ChatPage).messages.length,1);assert.equal(combinedReview('APPROVED','NOT_REQUIRED'),'NOT_REQUIRED');assert.equal(combinedReview('NOT_REQUIRED','REJECTED'),'REJECTED');
});
