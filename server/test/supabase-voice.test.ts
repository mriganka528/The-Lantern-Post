import assert from 'node:assert/strict';
import { after,before,beforeEach,test } from 'node:test';
import { createServer } from 'node:http';
import { createHash,randomUUID } from 'node:crypto';
import { createFriendsTestApp } from './friends-fixture';
import { syntheticWebm } from './voice-fixture';
import { validateEnvironment } from '../src/config/environment';
import type { VoiceUploadGrant,DeliveryReceipt,OpenedFriendLetter,WorldReceipt,WorldLetter } from '@lantern-post/shared-types';
const key='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({role:'service_role'})).toString('base64url')+'.synthetic-signature';
const calls:string[]=[];const bucket='lantern-voice';const objects=new Map<string,Buffer>();let publicBucket=false;let failWrite=false;let signedTarget:string|null=null;let beforeWrite:(()=>Promise<void>)|null=null;let beforeSign:(()=>Promise<void>)|null=null;let context:Awaited<ReturnType<typeof createFriendsTestApp>>;let origin='';
const storage=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url!,origin);calls.push(req.method+' '+url.pathname);const prefix='/storage/v1/object/';
    if(url.pathname.startsWith(prefix+'sign/')&&req.method==='GET'){
      const bytes=objects.get(url.pathname.slice((prefix+'sign/'+bucket+'/').length));if(url.searchParams.get('token')!=='fixture-playback'||!bytes){res.writeHead(403).end();return;}res.setHeader('Content-Type','audio/webm');res.setHeader('Content-Length',bytes.length);res.end(bytes);return;
    }
    if(req.headers.apikey!==key||req.headers.authorization!=='Bearer '+key){res.writeHead(403).end();return;}
    res.setHeader('Content-Type','application/json');
    if(url.pathname==='/storage/v1/bucket/'+bucket){res.end(JSON.stringify({id:bucket,public:publicBucket,file_size_limit:8388608,allowed_mime_types:['audio/webm','audio/mp4']}));return;}
    if(url.pathname.startsWith(prefix+'authenticated/'+bucket+'/')){const bytes=objects.get(url.pathname.slice((prefix+'authenticated/'+bucket+'/').length));if(!bytes){res.writeHead(404).end();return;}res.setHeader('Content-Type','audio/webm');res.setHeader('Content-Length',bytes.length);res.end(bytes);return;}
    const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));const body=Buffer.concat(chunks);
    if(req.method==='POST'&&url.pathname.startsWith(prefix+'sign/'+bucket+'/')){if(beforeSign)await beforeSign();assert.deepEqual(JSON.parse(body.toString()),{expiresIn:300});res.end(JSON.stringify({signedURL:signedTarget??url.pathname.replace('/storage/v1','')+'?token=fixture-playback'}));return;}
    if(req.method==='DELETE'&&url.pathname===prefix+bucket){const {prefixes}=JSON.parse(body.toString()) as {prefixes:string[]};assert.equal(prefixes.length,1);objects.delete(prefixes[0]!);res.end('[]');return;}
    if(req.method==='POST'&&url.pathname.startsWith(prefix+bucket+'/')){if(failWrite){res.writeHead(503).end('{}');return;}if(beforeWrite)await beforeWrite();assert.equal(req.headers['x-upsert'],'true');objects.set(url.pathname.slice((prefix+bucket+'/').length),body);res.end('{}');return;}
    res.writeHead(404).end('{}');
  }catch{res.writeHead(500).end('{}');}
});
before(async()=>{await new Promise<void>(resolve=>storage.listen(0,'127.0.0.1',resolve));const address=storage.address();assert.ok(address&&typeof address!=='string');origin='http://127.0.0.1:'+address.port;context=await createFriendsTestApp(false,undefined,undefined,'disabled',{SUPABASE_URL:origin,SUPABASE_VOICE_BUCKET:bucket,SUPABASE_SERVICE_ROLE_KEY:key,VOICE_STORAGE_BUDGET_BYTES:16777216});});
beforeEach(()=>{context.fixture.reset();objects.clear();calls.length=0;publicBucket=false;failWrite=false;signedTarget=null;beforeWrite=null;beforeSign=null;context.fixture.state.requests.push({id:'friends',fromUserId:'owner-alice',toUserId:'owner-bob',status:'ACCEPTED',createdAt:new Date()});});
after(async()=>{await context.app.close();storage.closeAllConnections();await new Promise<void>(resolve=>storage.close(()=>resolve()));});
const call=(path:string,who='alice',body?:unknown)=>fetch(context.url+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+who,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
const metadata=(bytes=syntheticWebm(),world=false)=>({requestId:randomUUID(),mimeType:'audio/webm',byteLength:bytes.length,durationMs:2000,sha256:createHash('sha256').update(bytes).digest('base64'),...(world?{destinationType:'INFINITY'}:{recipientId:'owner-bob'})});
const content=(id:string,bytes=syntheticWebm(),who='alice',mime='audio/webm')=>fetch(context.url+'/voice/uploads/'+id+'/content',{method:'POST',headers:{Authorization:'Bearer '+who,'Content-Type':mime},body:bytes});
async function reserve(world=false){const body=metadata(syntheticWebm(),world);const response=await call('/voice/uploads','alice',body);assert.equal(response.status,200);return {body,grant:await response.json() as VoiceUploadGrant};}
async function prepare(world=false){const {body,grant}=await reserve(world);assert.equal((await content(grant.assetId)).status,200);const finished=await call('/voice/uploads/'+grant.assetId+'/finish','alice',{});assert.equal(finished.status,200,JSON.stringify({response:await finished.text(),calls,keys:[...objects.keys()]}));return {body,grant};}
function letter(body:ReturnType<typeof metadata>,assetId:string,world=false){return {requestId:body.requestId,type:'VOICE',destinationType:world?'INFINITY':'FRIEND',presetId:'preset_lantern',voiceAssetId:assetId,voiceCaption:'Words with this synthetic recording.',...(world?{isSigned:false,publicConfirmed:true}:{recipientId:'owner-bob',deliveryConfirmed:true})};}
test('Supabase configuration requires a server service_role key and never accepts mixed providers',()=>{
  const base={NODE_ENV:'test',DATABASE_URL:'postgresql://localhost/test'};const settings={SUPABASE_URL:'https://test-project.supabase.co',SUPABASE_VOICE_BUCKET:bucket,SUPABASE_SERVICE_ROLE_KEY:key};assert.equal(validateEnvironment({...base,...settings}).SUPABASE_VOICE_STORAGE?.budgetBytes,268435456);
  for(const invalid of [{SUPABASE_URL:'https://untrusted.invalid'},{SUPABASE_SERVICE_ROLE_KEY:'sb_publishable_private-looking'},{SUPABASE_VOICE_BUCKET:'../other'},{VOICE_STORAGE_BUDGET_BYTES:9999999999}])assert.throws(()=>validateEnvironment({...base,...settings,...invalid}));
  assert.throws(()=>validateEnvironment({...base,...settings,VOICE_STORAGE_ENDPOINT:'https://storage.example.invalid',VOICE_STORAGE_BUCKET:'bucket',VOICE_STORAGE_REGION:'auto',VOICE_STORAGE_ACCESS_KEY_ID:'test',VOICE_STORAGE_SECRET_ACCESS_KEY:'test'}),/one voice-storage provider/);
});
test('API uploads, validates, delivers and plays a private recording without exposing the storage key',async()=>{
  const {body,grant}=await prepare();assert.equal(grant.uploadViaApi,true);assert.equal(grant.uploadUrl,null);assert.ok(!JSON.stringify(grant).includes(key));assert.ok(objects.has('voice/incoming/'+grant.assetId));assert.ok(objects.has('voice/sealed/'+grant.assetId));
  const response=await call('/letters','alice',letter(body,grant.assetId));assert.equal(response.status,200);const receipt=await response.json() as DeliveryReceipt;assert.equal(receipt.outcome,'DELIVERED');const opened=await call('/letters/friends/'+receipt.letterId+'/open','bob',{});assert.equal(opened.status,200);const value=await opened.json() as OpenedFriendLetter;assert.ok(value.audio);assert.ok(!JSON.stringify(value).includes(key));assert.ok(Date.parse(value.audio.expiresAt)<=Date.now()+300000);assert.deepEqual(Buffer.from(await(await fetch(value.audio.url)).arrayBuffer()),syntheticWebm());
  assert.equal((await fetch(origin+'/storage/v1/object/authenticated/'+bucket+'/voice/sealed/'+grant.assetId)).status,403);assert.equal((await call('/letters/friends/'+receipt.letterId+'/open','carol',{})).status,404);assert.equal(context.fixture.state.letters[0]?.moderationSkipped,true);
});
test('public voice uses the same private bucket and an unsigned authorized reader',async()=>{
  const {body,grant}=await prepare(true);const receipt=await(await call('/letters','alice',letter(body,grant.assetId,true))).json() as WorldReceipt;assert.equal(receipt.outcome,'DELIVERED');const reader=await(await call('/infinity/stars/'+receipt.letterId+'/open','bob',{})).json() as WorldLetter;assert.equal(reader.signature,null);assert.ok(reader.audio?.url.startsWith(origin));assert.ok(!JSON.stringify(reader).includes('owner-alice'));
});
test('API upload enforces identity, MIME, length, checksum and the current friendship',async()=>{
  const {grant}=await reserve();assert.equal((await content(grant.assetId,syntheticWebm(),'forged')).status,401);assert.equal((await content(grant.assetId,syntheticWebm(),'bob')).status,404);assert.equal((await content(grant.assetId,syntheticWebm(),'alice','application/json')).status,400);assert.equal((await content(grant.assetId,Buffer.alloc(syntheticWebm().length))).status,409);assert.equal(objects.size,0);
  context.fixture.state.blocks.push({id:'closed',blockerId:'owner-bob',blockedId:'owner-alice'});assert.equal((await content(grant.assetId)).status,404);assert.equal(objects.size,0);
});
test('public buckets and provider failures stop delivery without consuming the recording request',async()=>{
  const {grant}=await reserve();publicBucket=true;let response=await content(grant.assetId);assert.equal(response.status,503);assert.ok(!(await response.text()).includes(key));assert.equal(objects.size,0);publicBucket=false;failWrite=true;response=await content(grant.assetId);assert.equal(response.status,503);assert.equal(context.fixture.state.voiceAssets[0]?.status,'UPLOADING');assert.equal(context.fixture.state.letters.length,0);failWrite=false;assert.equal((await content(grant.assetId)).status,200);
});
test('a cancelled in-flight API upload cannot promote and its late incoming object is queued for cleanup',async()=>{
  const {body,grant}=await reserve();const row=context.fixture.state.voiceAssets[0]!;row.expiresAt=new Date(Date.now()+1000);
  beforeWrite=async()=>{assert.ok((context.fixture.state.voiceAssets[0]!.expiresAt as Date).getTime()>Date.now()+100000);await call('/letters/friends/requests/'+body.requestId+'/cancel','alice',{recipientId:'owner-bob'});};
  assert.equal((await content(grant.assetId)).status,404);assert.equal(context.fixture.state.voiceAssets[0]?.status,'DELETED');assert.ok(objects.has('voice/incoming/'+grant.assetId));assert.equal((await call('/voice/uploads/'+grant.assetId+'/finish','alice',{})).status,409);context.fixture.state.voiceAssets[0]!.expiresAt=new Date(0);await context.voiceAssets.cleanup();assert.equal(objects.size,0);
});
test('free-storage reservation counts both copies and preserves existing assets when full',async()=>{
  context.fixture.state.voiceAssets.push({id:'reserved',ownerId:'owner-bob',byteLength:8388608,status:'READY',stageClearedAt:null,contentClearedAt:null,createdAt:new Date(),expiresAt:new Date(Date.now()+100000)});
  const response=await call('/voice/uploads','alice',metadata());assert.equal(response.status,409);assert.equal((await response.json() as {code:string}).code,'VOICE_STORAGE_FULL');assert.equal(context.fixture.state.voiceAssets.length,1);assert.equal(objects.size,0);
});
test('deleting a delivered recording removes sealed bytes and keeps cleanup repeatable',async()=>{
  const {body,grant}=await prepare();const receipt=await(await call('/letters','alice',letter(body,grant.assetId))).json() as DeliveryReceipt;assert.equal((await call('/letters/friends/'+receipt.letterId+'/delete','bob',{})).status,200);assert.equal((await call('/letters/friends/'+receipt.letterId+'/open','alice',{})).status,200);assert.equal((await call('/letters/friends/'+receipt.letterId+'/delete','alice',{})).status,200);context.fixture.state.voiceAssets[0]!.expiresAt=new Date(0);await context.voiceAssets.cleanup();await context.voiceAssets.cleanup();assert.equal(objects.size,0);
});
test('foreign playback links cannot be returned as Supabase recording grants',async()=>{
  const {body,grant}=await prepare();const receipt=await(await call('/letters','alice',letter(body,grant.assetId))).json() as DeliveryReceipt;signedTarget='https://outside.invalid/recording?token=unsafe';assert.equal((await call('/letters/friends/'+receipt.letterId+'/open','bob',{})).status,503);
});

test('a block during playback signing closes access before a private link is returned',async()=>{
  const {body,grant}=await prepare();const receipt=await(await call('/letters','alice',letter(body,grant.assetId))).json() as DeliveryReceipt;
  beforeSign=async()=>{context.fixture.state.blocks.push({id:'late-block',blockerId:'owner-alice',blockedId:'owner-bob'});};
  assert.equal((await call('/letters/friends/'+receipt.letterId+'/open','bob',{})).status,404);
});
