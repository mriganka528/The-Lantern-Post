import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Environment } from '../config/environment';
import { signObjectUrl } from './s3-signing';
import type { S3Settings } from './s3-signing';
import { MAX_VOICE_BYTES } from './voice-limits';
import type { VoiceMime } from './voice-limits';
import { SupabaseVoiceStorage,validVoiceKey } from './supabase-voice-storage';
export interface VoiceObjectGrant { url:string; expiresAt:Date; }
export interface VoiceStorageGrant { url:string|null; expiresAt:Date; viaApi?:boolean; }
@Injectable()
export class VoiceStorageService {
  constructor(private readonly config: ConfigService<Environment, true>) {}
  get available() { return Boolean(this.config.get('VOICE_STORAGE')||this.config.get('SUPABASE_VOICE_STORAGE')); }
  get proxyUploads() { return Boolean(this.config.get('SUPABASE_VOICE_STORAGE')); }
  get budgetBytes() { return this.config.get('SUPABASE_VOICE_STORAGE')?.budgetBytes; }
  private supabase() {const settings=this.config.get('SUPABASE_VOICE_STORAGE');return settings?new SupabaseVoiceStorage(settings):null;}
  private settings(): S3Settings { const settings = this.config.get('VOICE_STORAGE'); if (!settings) throw new ServiceUnavailableException({ code: 'VOICE_STORAGE_UNAVAILABLE', message: 'Voice delivery storage is not configured.' }); return settings; }
  private async request(url: string, options: RequestInit) {
    try { return await fetch(url, options); }
    catch { throw new ServiceUnavailableException({ code: 'VOICE_STORAGE_UNAVAILABLE', message: 'Voice storage could not be reached. Please try again.' }); }
  }
  upload(key: string, byteLength: number, mimeType: VoiceMime, seconds = 600):VoiceStorageGrant {
    if (seconds < 1) throw new ServiceUnavailableException({ code: 'VOICE_UPLOAD_EXPIRED' });
    if(!validVoiceKey(key)||!key.startsWith('voice/incoming/')||byteLength<64||byteLength>MAX_VOICE_BYTES)throw Error('Invalid recording upload.');
    if(this.proxyUploads)return {url:null,viaApi:true,expiresAt:new Date(Date.now()+seconds*1000)};
    return { url: signObjectUrl(this.settings(), 'PUT', key, seconds, new Date(), { 'content-length': String(byteLength), 'content-type': mimeType }), expiresAt: new Date(Date.now() + seconds * 1000) };
  }
  playback(key: string):VoiceObjectGrant|Promise<VoiceObjectGrant> { const supabase=this.supabase();if(supabase)return supabase.playback(key);return { url: signObjectUrl(this.settings(), 'GET', key, 300), expiresAt: new Date(Date.now() + 300_000) }; }
  async put(key: string, bytes: Uint8Array, mimeType: VoiceMime) {
    const supabase=this.supabase();if(supabase)return supabase.put(key,bytes,mimeType);
    const headers = { 'content-length': String(bytes.length), 'content-type': mimeType, 'cache-control': 'private, no-store, max-age=0' };
    const response = await this.request(signObjectUrl(this.settings(), 'PUT', key, 60, new Date(), headers), { method: 'PUT', headers, body: new Uint8Array(bytes).buffer, redirect: 'error', signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new ServiceUnavailableException('The checked recording could not be kept.');
  }
  async read(key: string, expectedBytes: number): Promise<Uint8Array> {
    if(!Number.isSafeInteger(expectedBytes)||expectedBytes<64||expectedBytes>MAX_VOICE_BYTES)throw Error('Invalid recording length.');
    const supabase=this.supabase();const response = supabase?await supabase.read(key):await this.request(signObjectUrl(this.settings(), 'GET', key, 60), { redirect: 'error', signal: AbortSignal.timeout(12_000) });
    const header=response.headers.get('content-length');const length=header===null?null:Number(header);
    if (!response.ok || !response.body || length!==null&&(!Number.isSafeInteger(length)||length!==expectedBytes||length>MAX_VOICE_BYTES)) { await response.body?.cancel(); throw new ServiceUnavailableException({ code: 'VOICE_UPLOAD_INCOMPLETE', message: 'The recording upload could not be confirmed.' }); }
    const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > expectedBytes || size > MAX_VOICE_BYTES) throw new Error('Oversized recording'); chunks.push(part.value); } }
    catch { await reader.cancel().catch(() => {}); throw new ServiceUnavailableException('The recording could not be checked.'); }
    if (size !== expectedBytes) throw new ServiceUnavailableException('The upload is incomplete.');
    const result = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; } return result;
  }
  async remove(key: string) {
    const supabase=this.supabase();if(supabase)return supabase.remove(key);
    const response = await this.request(signObjectUrl(this.settings(), 'DELETE', key, 60), { redirect: 'error', signal: AbortSignal.timeout(10_000) });
    if (!response.ok && response.status !== 404) throw new ServiceUnavailableException('The recording could not be cleared yet.');
  }
}
