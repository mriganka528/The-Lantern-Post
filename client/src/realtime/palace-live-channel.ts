import type { PalaceEventPage } from '@lantern-post/shared-types';
import type { SocketPort } from '../chat/chat-socket';
import { readPalaceEvents } from './palace-live-contract';
export class PalaceLiveChannel {
  private socket:SocketPort|null=null;private ended=false;private timeout:ReturnType<typeof setTimeout>|undefined;private finish:()=>void=()=>{};
  constructor(private url:string,private token:()=>Promise<string|null>,private create:(url:string)=>SocketPort,private signal:AbortSignal){}
  async listen(after:number|null,onPage:(page:PalaceEventPage)=>void,onClosed:()=>void):Promise<void>{
    const token=await this.token();if(!token||this.signal.aborted)return;
    return new Promise<void>(resolve=>{this.finish=resolve;this.signal.addEventListener('abort',this.close,{once:true});if(this.signal.aborted){this.close();return;}try{const socket=this.create(this.url);this.socket=socket;this.timeout=setTimeout(this.close,12000);socket.onopen=()=>{if(!this.ended)socket.send(JSON.stringify({type:'subscribe',token,after}));};socket.onmessage=e=>{if(this.ended)return;try{if(typeof e.data!=='string'||e.data.length>100000)throw Error();const data=JSON.parse(e.data) as {type?:string;page?:unknown};if(data.type==='closed'){onClosed();this.close();return;}if(data.type!=='events')throw Error();const page=readPalaceEvents(data.page);clearTimeout(this.timeout);this.timeout=setTimeout(this.close,25000);onPage(page);}catch{this.close();}};socket.onerror=this.close;socket.onclose=this.close;}catch{this.close();}});
  }
  close=()=>{if(this.ended)return;this.ended=true;clearTimeout(this.timeout);this.signal.removeEventListener('abort',this.close);if(this.socket){this.socket.onopen=this.socket.onclose=this.socket.onerror=this.socket.onmessage=null;this.socket.close();}this.finish();};
}
