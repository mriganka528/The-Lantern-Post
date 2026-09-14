// Isolated local/CI PostgreSQL only. Never loads server/.env or a live provider.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const raw=process.env.LIVE_PALACE_TEST_DATABASE_URL;const url=raw?new URL(raw):null;
if(!url||!['localhost','127.0.0.1','::1','[::1]','postgres'].includes(url.hostname)||! /_(test|ci)$/.test(url.pathname))throw Error('Set LIVE_PALACE_TEST_DATABASE_URL to a dedicated local database ending in _test or _ci.');
const require=createRequire(import.meta.url);const {PrismaClient}=require('@prisma/client');const {PalaceEvents}=require('../dist/realtime/palace-events.js');const {ChatService}=require('../dist/chat/chat.service.js');const {ChatSignal}=require('../dist/chat/chat-signal.js');const {SafetyService}=require('../dist/safety/safety.service.js');const {FriendLettersService}=require('../dist/letters/friend-letters.service.js');const {VoiceAssetsService}=require('../dist/voice/voice-assets.service.js');
const prisma=new PrismaClient({datasources:{db:{url:raw}}});const events=new PalaceEvents(prisma);const users=[];
try {
  const character=await prisma.character.findFirst({where:{isActive:true}});const preset=await prisma.preset.findFirst({where:{isActive:true}});assert.ok(character&&preset);const suffix=randomUUID().slice(0,8);
  for(let i=0;i<2;i++)users.push(await prisma.user.create({data:{username:`live_${suffix}_${i}`,authProviderId:`live_fixture_${suffix}_${i}`,characterId:character.id}}));
  const [alice,bob]=users;await prisma.friendRequest.create({data:{fromUserId:alice.id,toUserId:bob.id,status:'ACCEPTED',respondedAt:new Date()}});
  const policy={disabled:true,available:true,check:async()=> 'NOT_REQUIRED'};const chat=new ChatService(prisma,policy,new SafetyService(prisma,events),new ChatSignal(),events);
  await Promise.all([chat.send(alice.authProviderId,bob.id,{requestId:randomUUID(),text:'Synthetic message one.',confirmed:true}),chat.send(bob.authProviderId,alice.id,{requestId:randomUUID(),text:'Synthetic message two.',confirmed:true})]);
  for(const user of users){const page=await events.read(user.id,0);assert.deepEqual(page.events.map(e=>e.sequence),[1,2]);assert.equal(page.cursor,2);assert.ok(!JSON.stringify(page).includes('Synthetic message'));}
  const letters=new FriendLettersService(prisma,policy,new VoiceAssetsService(prisma,{available:false}),events);const result=await letters.send(alice.authProviderId,{requestId:randomUUID(),type:'TEXT',destinationType:'FRIEND',recipientId:bob.id,presetId:preset.id,textContent:'Synthetic independent copies.',deliveryConfirmed:true});
  await letters.remove(bob.authProviderId,result.letterId);assert.equal((await letters.open(alice.authProviderId,result.letterId)).textContent,'Synthetic independent copies.');await assert.rejects(letters.open(bob.authProviderId,result.letterId));await letters.remove(alice.authProviderId,result.letterId);assert.equal((await prisma.letter.findUnique({where:{id:result.letterId}})).textContent,null);
  console.log('PostgreSQL live palace checks passed: concurrent monotonic owner cursors, private metadata, independently deleted copies and final content purge.');
}finally{
  const ids=users.map(u=>u.id);await prisma.palaceEvent.deleteMany({where:{ownerId:{in:ids}}});await prisma.friendNotification.deleteMany({where:{userId:{in:ids}}});await prisma.chatReport.deleteMany({where:{reporterId:{in:ids}}});await prisma.chatReceipt.deleteMany({where:{ownerId:{in:ids}}});await prisma.chatMessage.deleteMany({where:{senderId:{in:ids}}});await prisma.chatThread.deleteMany({where:{OR:[{firstUserId:{in:ids}},{secondUserId:{in:ids}}]}});await prisma.deliveryReceipt.deleteMany({where:{ownerId:{in:ids}}});await prisma.letter.deleteMany({where:{senderId:{in:ids}}});await prisma.friendRequest.deleteMany({where:{OR:[{fromUserId:{in:ids}},{toUserId:{in:ids}}]}});await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect();
}
