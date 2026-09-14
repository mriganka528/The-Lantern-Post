// Explicit isolated PostgreSQL only. No .env, real identities or external providers.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const raw=process.env.PRIVACY_TEST_DATABASE_URL;const url=raw?new URL(raw):null;
if(!url||!['localhost','127.0.0.1','::1','[::1]','postgres'].includes(url.hostname)||! /_(test|ci)$/.test(url.pathname))throw Error('Set PRIVACY_TEST_DATABASE_URL to a dedicated local database ending in _test or _ci.');
const require=createRequire(import.meta.url);const {PrismaClient}=require('@prisma/client');const {AccountService}=require('../dist/account/account.service.js');const {AccountAccess}=require('../dist/account/account-access.js');const {ChatService}=require('../dist/chat/chat.service.js');const {ChatSignal}=require('../dist/chat/chat-signal.js');const {SafetyService}=require('../dist/safety/safety.service.js');
const prisma=new PrismaClient({datasources:{db:{url:raw}}});const users=[];const identityCalls=[];const accounts=new AccountService(prisma,{remove:async subject=>identityCalls.push(subject)},{cleanup:async()=>{}},{eraseOwner:async()=>{}});
try {
  const character=await prisma.character.findFirst({where:{isActive:true}});assert.ok(character);const suffix=randomUUID().slice(0,8);
  for(let i=0;i<2;i++)users.push(await prisma.user.create({data:{username:`privacy_${suffix}_${i}`,authProviderId:`privacy_fixture_${suffix}_${i}`,characterId:character.id}}));
  const [alice,bob]=users;await prisma.friendRequest.create({data:{fromUserId:alice.id,toUserId:bob.id,status:'ACCEPTED',respondedAt:new Date()}});
  const chat=new ChatService(prisma,{available:true,check:async()=> 'APPROVED'},new SafetyService(prisma),new ChatSignal());const input={requestId:randomUUID(),text:'Synthetic privacy test words',confirmed:true};const receipt=await chat.send(alice.authProviderId,bob.id,input);
  await accounts.request(alice.authProviderId,randomUUID(),alice.username);assert.equal((await prisma.chatMessage.findUnique({where:{id:receipt.messageId}})).text,'');assert.ok(await prisma.chatReceipt.findFirst({where:{ownerId:alice.id}}));await assert.rejects(new AccountAccess(prisma).assertSubject(alice.authProviderId));
  await accounts.sweep();assert.equal((await accounts.status(alice.authProviderId)).deletion.state,'COMPLETE');assert.deepEqual(identityCalls,[alice.authProviderId]);assert.equal((await prisma.user.findUnique({where:{id:bob.id}})).username,bob.username);
  await assert.rejects(prisma.chatMessage.update({where:{id:receipt.messageId},data:{text:'Cannot revive erased messages'}}));console.log('PostgreSQL privacy checks passed: atomic erasure, retained receipts, active-account fence, external cleanup and erased-content constraint.');
} finally {
  const ids=users.map(u=>u.id);await prisma.chatReport.deleteMany({where:{reporterId:{in:ids}}});await prisma.chatReceipt.deleteMany({where:{ownerId:{in:ids}}});await prisma.chatMessage.deleteMany({where:{senderId:{in:ids}}});await prisma.chatThread.deleteMany({where:{OR:[{firstUserId:{in:ids}},{secondUserId:{in:ids}}]}});await prisma.accountDeletion.deleteMany({where:{ownerId:{in:ids}}});await prisma.friendRequest.deleteMany({where:{OR:[{fromUserId:{in:ids}},{toUserId:{in:ids}}]}});await prisma.user.deleteMany({where:{id:{in:ids}}});await prisma.$disconnect();
}
