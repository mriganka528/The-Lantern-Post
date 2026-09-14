// Operator-invoked setup of a dedicated PRIVATE bucket. No billing, database,
// authentication-user, public bucket or moderation changes are made.
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const require=createRequire(import.meta.url);const root=fileURLToPath(new URL('../../',import.meta.url));
require('dotenv').config({path:fileURLToPath(new URL('../.env',import.meta.url)),quiet:true});
async function runBuild(){await new Promise((resolve,reject)=>{const child=process.platform==='win32'?spawn(process.env.ComSpec??'cmd.exe',['/d','/s','/c','npm.cmd run build:api'],{cwd:root,stdio:'inherit',windowsHide:true}):spawn('npm',['run','build:api'],{cwd:root,stdio:'inherit'});child.once('error',reject);child.once('exit',code=>code===0?resolve():reject(Error('Build failed.')));});}
function syntheticWebm() {
  const ebml=(id,data)=>{const size=data.length<127?Buffer.from([128|data.length]):Buffer.from([64|(data.length>>8),data.length&255]);return Buffer.concat([Buffer.from(id,'hex'),size,data]);};
  const header=ebml('1a45dfa3',ebml('4282',Buffer.from('webm')));
  const tracks=ebml('1654ae6b',ebml('ae',Buffer.concat([ebml('d7',Buffer.from([1])),ebml('83',Buffer.from([2])),ebml('86',Buffer.from('A_OPUS'))])));
  const blocks=[ebml('e7',Buffer.from([0]))];
  for(let time=0;time<2000;time+=20){const block=Buffer.alloc(7);block[0]=129;block.writeInt16BE(time,1);block[3]=128;block[4]=152;blocks.push(ebml('a3',block));}
  return Buffer.concat([header,ebml('18538067',Buffer.concat([tracks,ebml('1f43b675',Buffer.concat(blocks))]))]);
}
async function main(){
  for(const name of ['SUPABASE_URL','SUPABASE_VOICE_BUCKET','SUPABASE_SERVICE_ROLE_KEY'])if(!process.env[name]?.trim())throw Error(`Add ${name} to server/.env first. Use a Supabase Free project; do not add a payment card.`);
  if(['VOICE_STORAGE_ENDPOINT','VOICE_STORAGE_BUCKET','VOICE_STORAGE_REGION','VOICE_STORAGE_ACCESS_KEY_ID','VOICE_STORAGE_SECRET_ACCESS_KEY'].some(name=>process.env[name]?.trim()))throw Error('Clear the legacy S3 voice settings before choosing Supabase.');
  await runBuild();
  const {supabaseVoiceSettings}=require('../dist/voice/supabase-settings.js');const {SupabaseVoiceStorage}=require('../dist/voice/supabase-voice-storage.js');
  const settings=supabaseVoiceSettings(process.env,process.env.NODE_ENV==='production');if(!settings)throw Error('Voice storage is not configured.');
  const headers={apikey:settings.serviceRoleKey,Authorization:'Bearer '+settings.serviceRoleKey,'Content-Type':'application/json'};
  const bucketUrl=settings.url+'/storage/v1/bucket/'+encodeURIComponent(settings.bucket);let response;
  try{response=await fetch(bucketUrl,{headers,redirect:'error',signal:AbortSignal.timeout(15000)});}catch{throw Error('Could not reach Supabase. Check SUPABASE_URL and that the project is running.');}
  const body=await response.json().catch(()=>null);
  if(response.status===404||response.status===400&&String(body?.statusCode)==='404'){
    response=await fetch(settings.url+'/storage/v1/bucket',{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(15000),body:JSON.stringify({id:settings.bucket,name:settings.bucket,public:false,file_size_limit:8388608,allowed_mime_types:['audio/webm','audio/mp4']})});
    if(!response.ok)throw Error('Could not create the private bucket. Check the service_role key and project quota.');console.log('Created the private voice bucket with an 8 MiB file limit.');
  }else if(!response.ok)throw Error('Supabase rejected access. Check the project URL and the legacy service_role key.');
  const provider=new SupabaseVoiceStorage(settings);await provider.privateBucket();console.log('Private bucket verified. No public access policy was created.');
  const {createHash}=require('node:crypto');const id='voice_'+createHash('sha256').update('setup-fixture:'+randomUUID()).digest('hex');const incoming='voice/incoming/'+id;const sealed='voice/sealed/'+id;let cleanupFailed=false;
  try{
    const bytes=syntheticWebm();await provider.put(incoming,bytes,'audio/webm');const read=new Uint8Array(await(await provider.read(incoming)).arrayBuffer());if(!Buffer.from(read).equals(bytes))throw Error('The storage read did not match the upload.');await provider.put(sealed,read,'audio/webm');const grant=await provider.playback(sealed);const playback=await fetch(grant.url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!playback.ok||!Buffer.from(await playback.arrayBuffer()).equals(bytes))throw Error('The temporary playback link could not be verified.');console.log('Synthetic upload, private read, sealed copy and temporary playback passed.');
  }finally{for(const path of [incoming,sealed])try{await provider.remove(path);}catch{cleanupFailed=true;}if(cleanupFailed)throw Error('Test cleanup needs retry. Run setup:voice-storage again and remove any setup test objects from the private bucket if needed.');}
  console.log('Voice storage is ready. Restart the API. Your local recordings and existing database are unchanged.');
}
main().catch(error=>{console.error(error instanceof Error && !/https?:\/\/|Bearer|eyJ|sb_secret_/.test(error.message)?error.message:'Voice storage setup failed. Check the private bucket, project status and server-only credentials.');process.exitCode=1;});
