import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { MAX_VOICE_BYTES } from './voice-limits';
export async function readVoiceUpload(request:IncomingMessage,expectedBytes:number,mimeType:string):Promise<Uint8Array> {
  const type=request.headers['content-type']?.split(';')[0]?.trim();const length=request.headers['content-length'];
  if(type!==mimeType||length!==undefined&&Number(length)!==expectedBytes)throw new BadRequestException('The recording does not match its upload.');
  const timer=setTimeout(()=>request.destroy(),30000);timer.unref();const chunks:Buffer[]=[];let size=0;
  try {
    for await(const chunk of request){const bytes=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk as Uint8Array);size+=bytes.length;if(size>expectedBytes||size>MAX_VOICE_BYTES)throw new PayloadTooLargeException('Recording too large.');chunks.push(bytes);}
    if(size!==expectedBytes)throw new BadRequestException('The recording upload is incomplete.');return new Uint8Array(Buffer.concat(chunks));
  }finally{clearTimeout(timer);}
}
