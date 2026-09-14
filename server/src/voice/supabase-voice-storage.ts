import { ServiceUnavailableException } from '@nestjs/common';
import type { SupabaseVoiceSettings } from './supabase-settings';
import type { VoiceMime } from './voice-limits';
import { MAX_VOICE_BYTES } from './voice-limits';
export const validVoiceKey=(key:string)=>/^voice\/(incoming|sealed)\/voice_[a-f0-9]{64}$/.test(key);
const unavailable=()=>new ServiceUnavailableException({code:'VOICE_STORAGE_UNAVAILABLE',message:'The recording cabinet could not be reached. Your voice letter is kept on this device.'});
export class SupabaseVoiceStorage {
  constructor(private settings:SupabaseVoiceSettings,private fetcher:typeof fetch=fetch) {}
  private objectPath(key:string) {if(!validVoiceKey(key))throw Error('Invalid recording object.');return encodeURIComponent(this.settings.bucket)+'/'+key;}
  private async request(path:string,options:RequestInit={}) {
    try {
      const response=await this.fetcher(this.settings.url+'/storage/v1'+path,{...options,headers:{apikey:this.settings.serviceRoleKey,Authorization:'Bearer '+this.settings.serviceRoleKey,...options.headers},redirect:'error',signal:AbortSignal.timeout(12000)});
      if(options.method==='DELETE'&&response.status===404)return response;
      if(!response.ok){await response.body?.cancel();throw unavailable();}return response;
    }catch{throw unavailable();}
  }
  async privateBucket() {
    const response=await this.request('/bucket/'+encodeURIComponent(this.settings.bucket));
    const bucket=await response.json().catch(()=>{throw unavailable();}) as {id?:string;public?:boolean;file_size_limit?:number|null;allowed_mime_types?:string[]|null};
    if(!bucket||typeof bucket!=='object'||bucket.allowed_mime_types!==undefined&&bucket.allowed_mime_types!==null&&(!Array.isArray(bucket.allowed_mime_types)||!bucket.allowed_mime_types.every(value=>typeof value==='string')))throw unavailable();
    if(bucket.id!==this.settings.bucket||bucket.public!==false)throw new ServiceUnavailableException({code:'VOICE_BUCKET_NOT_PRIVATE',message:'Voice delivery needs a private recording cabinet.'});
    return bucket;
  }
  async put(key:string,bytes:Uint8Array,mimeType:VoiceMime) {
    const path=this.objectPath(key);if(bytes.length<64||bytes.length>MAX_VOICE_BYTES||!['audio/webm','audio/mp4'].includes(mimeType))throw Error('Invalid recording.');
    const bucket=await this.privateBucket();
    if(bucket.file_size_limit && bytes.length>bucket.file_size_limit)throw new ServiceUnavailableException({code:'VOICE_STORAGE_FULL',message:'This recording is larger than the storage limit. Your voice letter is kept here.'});
    if(bucket.allowed_mime_types?.length&&!bucket.allowed_mime_types.some(value=>value===mimeType||value==='audio/*'||value==='*/*'))throw unavailable();
    await this.request('/object/'+path,{method:'POST',headers:{'Content-Type':mimeType,'cache-control':'private, no-store, max-age=0','x-upsert':'true'},body:new Uint8Array(bytes).buffer});
  }
  async read(key:string) {const path=this.objectPath(key);await this.privateBucket();return this.request('/object/authenticated/'+path);}
  async playback(key:string) {
    if(!key.startsWith('voice/sealed/'))throw Error('Only sealed recordings can be played.');
    const path=this.objectPath(key);await this.privateBucket();
    const started=Date.now();const response=await this.request('/object/sign/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn:300})});
    const value=await response.json().catch(()=>{throw unavailable();}) as {signedURL?:unknown;signedUrl?:unknown}|null;const raw=value?.signedURL??value?.signedUrl;
    if(typeof raw!=='string'||raw.length>16000)throw unavailable();
    const candidate=raw.startsWith('/object/')?'/storage/v1'+raw:raw;
    let signed:URL;try{signed=new URL(candidate,this.settings.url);}catch{throw unavailable();}
    if(signed.origin!==this.settings.url||signed.username||signed.password||signed.hash||signed.pathname!=='/storage/v1/object/sign/'+path||!signed.searchParams.get('token'))throw unavailable();
    return {url:signed.toString(),expiresAt:new Date(started+300000)};
  }
  async remove(key:string) {
    this.objectPath(key);
    // Cleanup remains available if the operator accidentally made the bucket public.
    await this.request('/object/'+encodeURIComponent(this.settings.bucket),{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:[key]})});
  }
}
