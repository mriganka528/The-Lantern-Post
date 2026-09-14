import { GoneException, Injectable, Module } from '@nestjs/common';
import type { OnModuleDestroy,OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DatabaseModule } from '../database/database.module';
import { privateLetters,correspondent } from '../letters/private-letter-contract';
import { releasedContent } from '../letters/content-review';
import { notBlocked } from '../friends/friend-contract';
import type { PalaceEventKind,PalaceLiveEvent,PalaceEventPage } from '@lantern-post/shared-types';
export interface NewPalaceEvent {id?:string;ownerId:string;kind:PalaceEventKind;peerId?:string;itemId?:string;}
@Injectable()
export class PalaceEvents implements OnModuleInit,OnModuleDestroy {
  private listeners=new Map<string,Set<()=>void>>();private versions=new Map<string,number>();private commits=new Set<()=>void>();private timer:ReturnType<typeof setInterval>|undefined;
  constructor(private prisma:PrismaService) {}
  onModuleInit(){this.timer=setInterval(()=>{const cutoff=new Date(Date.now()-7*86400000);void Promise.all([this.prisma.palaceEvent.deleteMany({where:{createdAt:{lt:cutoff}}}),this.prisma.friendNotification.deleteMany({where:{createdAt:{lt:new Date(Date.now()-86400000)}}})]).catch(()=>{});},3600000);this.timer.unref();}
  onModuleDestroy(){clearInterval(this.timer);this.listeners.forEach(set=>set.forEach(wake=>wake()));this.listeners.clear();}
  async append(tx:Prisma.TransactionClient,entries:NewPalaceEvent[]) {
    const ids=[...new Set(entries.map(event=>event.ownerId))].sort();const active=await tx.user.findMany({where:{id:{in:ids},accountState:'ACTIVE'},select:{id:true}});const live=new Set(active.map(user=>user.id));
    // Consistent user-lock order avoids crossed sender/recipient deadlocks.
    for(const ownerId of ids){if(!live.has(ownerId))continue;for(const event of entries.filter(row=>row.ownerId===ownerId)){
      const owner=await tx.user.update({where:{id:ownerId,accountState:'ACTIVE'},data:{realtimeSequence:{increment:1}},select:{realtimeSequence:true}});
      await tx.palaceEvent.create({data:{id:event.id??randomUUID(),ownerId,sequence:owner.realtimeSequence,kind:event.kind,peerId:event.peerId??null,itemId:event.itemId??null}});
    }}
  }
  version(ownerId:string){return this.versions.get(ownerId)??0;}
  notifyAll(){this.notify([...this.listeners.keys()]);}
  notify(owners:string[]){for(const id of new Set(owners)){this.versions.set(id,this.version(id)+1);this.listeners.get(id)?.forEach(wake=>wake());}this.commits.forEach(wake=>wake());if(this.versions.size>10000){for(const id of this.versions.keys()){if(!this.listeners.has(id))this.versions.delete(id);if(this.versions.size<=8000)break;}}}
  onCommit(wake:()=>void){this.commits.add(wake);return()=>{this.commits.delete(wake);};}
  wait(ownerId:string,version:number,signal:AbortSignal,ms=3000):Promise<void>{return new Promise(resolve=>{if(signal.aborted||this.version(ownerId)!==version){resolve();return;}const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);const set=this.listeners.get(ownerId);set?.delete(done);if(!set?.size)this.listeners.delete(ownerId);resolve();};const set=this.listeners.get(ownerId)??new Set();set.add(done);this.listeners.set(ownerId,set);const timer=setTimeout(done,ms);signal.addEventListener('abort',done,{once:true});});}
  async inbox(ownerId: string): Promise<PalaceEventPage> {
    const owner = await this.prisma.user.findFirst({ where: { id: ownerId, accountState: 'ACTIVE' }, select: { realtimeSequence: true } });
    if (!owner) throw new GoneException();
    const rows = await this.prisma.palaceEvent.findMany({ where: { ownerId, kind: { in: ['LETTER_RECEIVED', 'CHAT_RECEIVED', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED'] }, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } }, orderBy: { sequence: 'desc' }, take: 50 });
    const ids = (...kinds: string[]) => rows.filter(row => kinds.includes(row.kind)).map(row => row.itemId).filter((id): id is string => Boolean(id));
    const letterIds = ids('LETTER_RECEIVED'), messageIds = ids('CHAT_RECEIVED'), invitationIds = ids('FRIEND_REQUEST', 'FRIEND_ACCEPTED');
    // Batch current-access checks. History is available without push credentials,
    // and contains no letter words, captions, message text or sender names.
    const [letters, messages, invitations] = await Promise.all([
      letterIds.length ? this.prisma.letter.findMany({ where: { AND: [privateLetters(ownerId), { id: { in: letterIds }, recipientId: ownerId }] }, select: { id: true, readAt: true } }) : [],
      messageIds.length ? this.prisma.chatMessage.findMany({ where: { id: { in: messageIds }, erasedAt: null, senderId: { not: ownerId }, AND: [releasedContent], sender: correspondent(ownerId), thread: { OR: [{ firstUserId: ownerId }, { secondUserId: ownerId }] } }, select: { id: true } }) : [],
      invitationIds.length ? this.prisma.friendRequest.findMany({ where: { id: { in: invitationIds }, fromUser: notBlocked(ownerId), toUser: notBlocked(ownerId), OR: [{ toUserId: ownerId, status: 'PENDING' }, { fromUserId: ownerId, status: 'ACCEPTED' }] }, select: { id: true } }) : [],
    ]);
    const visible = new Set([...letters, ...messages, ...invitations].map(row => row.id));
    const unreadLetters = new Set(letters.filter(row => !row.readAt).map(row => row.id));
    const events = rows.filter(row => row.itemId && visible.has(row.itemId)).reverse().map(row => ({ id: row.id, sequence: row.sequence, kind: row.kind as PalaceEventKind, peerId: row.peerId, itemId: row.itemId, createdAt: row.createdAt.toISOString(), alert: row.kind !== 'LETTER_RECEIVED' || unreadLetters.has(row.itemId!) }));
    return { events, cursor: Math.max(owner.realtimeSequence, ...rows.map(row => row.sequence)), reset: false };
  }
  async read(ownerId:string,after:number|null):Promise<PalaceEventPage>{
    const owner=await this.prisma.user.findFirst({where:{id:ownerId,accountState:'ACTIVE'},select:{realtimeSequence:true}});if(!owner)throw new GoneException();
    if(after===null||after>owner.realtimeSequence)return {events:[],cursor:owner.realtimeSequence,reset:true};
    if(after===owner.realtimeSequence)return {events:[],cursor:after,reset:false};
    const rows=await this.prisma.palaceEvent.findMany({where:{ownerId,sequence:{gt:after}},orderBy:{sequence:'asc'},take:50});const events:PalaceLiveEvent[]=[];
    for(const row of rows){let alert=false;const recent=Date.now()-row.createdAt.getTime()<300000;let kind=row.kind as PalaceEventKind;
      if(recent&&kind==='LETTER_RECEIVED')alert=Boolean(await this.prisma.letter.findFirst({where:{AND:[privateLetters(ownerId),{id:row.itemId!,recipientId:ownerId,readAt:null}]},select:{id:true}}));
      if(recent&&kind==='CHAT_RECEIVED')alert=Boolean(await this.prisma.chatMessage.findFirst({where:{id:row.itemId!,erasedAt:null,AND:[releasedContent],senderId:row.peerId!,sender:correspondent(ownerId),thread:{OR:[{firstUserId:ownerId},{secondUserId:ownerId}]}},select:{id:true}}));
      if(recent&&(kind==='FRIEND_REQUEST'||kind==='FRIEND_ACCEPTED'))alert=Boolean(await this.prisma.friendRequest.findFirst({where:{id:row.itemId!,status:kind==='FRIEND_REQUEST'?'PENDING':'ACCEPTED',...(kind==='FRIEND_REQUEST'?{toUserId:ownerId}:{fromUserId:ownerId}),fromUser:notBlocked(ownerId),toUser:notBlocked(ownerId)},select:{id:true}}));
      if(!alert&&kind==='LETTER_RECEIVED')kind='LETTERBOX_CHANGED';if(!alert&&kind==='CHAT_RECEIVED')kind='CHAT_CHANGED';
      events.push({id:row.id,sequence:row.sequence,kind,peerId:row.peerId,itemId:row.itemId,createdAt:row.createdAt.toISOString(),alert});
    }
    return {events,cursor:rows.at(-1)?.sequence??owner.realtimeSequence,reset:rows.length?rows[0]!.sequence>after+1:owner.realtimeSequence>after};
  }
}
@Module({imports:[DatabaseModule],providers:[PalaceEvents],exports:[PalaceEvents]})
export class PalaceEventsModule {}
