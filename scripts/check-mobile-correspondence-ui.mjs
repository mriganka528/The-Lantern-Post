// Real UI and HTTP/socket services with synthetic identities and in-memory
// storage. No live Clerk, Supabase, microphone, provider credentials or sends.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { forwardFixtureApi } from './browser-api-proxy.mjs';
const root=fileURLToPath(new URL('..',import.meta.url)),require=createRequire(import.meta.url),mobileRequire=createRequire(resolve(root,'client/package.json'));
const ts=require('typescript'),webpack=require('webpack');
require.extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2023,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText,file);
const {createFriendsTestApp}=require('../server/test/friends-fixture.ts');
const {memoryVoiceStorage,syntheticM4a}=require('../server/test/voice-fixture.ts');
const {serializePreset}=require('../server/src/presets/preset.ts');
const media=memoryVoiceStorage();media.storage.proxyUploads=true;media.storage.upload=()=>({url:null,viaApi:true,expiresAt:new Date(Date.now()+600000)});
const backend=await createFriendsTestApp(false,undefined,media.storage,'disabled',{WEB_ORIGINS:'http://127.0.0.1'});
backend.fixture.state.requests.push({id:'accepted',fromUserId:'owner-alice',toUserId:'owner-bob',status:'ACCEPTED',createdAt:new Date(),respondedAt:new Date()});
const preset=serializePreset(backend.fixture.state.presets[0]);const voiceBytes=[...syntheticM4a()];
const path=value=>JSON.stringify(resolve(root,value).replaceAll('\\','/'));
const entry=`
import React,{useMemo} from 'react';import {AppRegistry} from 'react-native';import {SafeAreaProvider} from 'react-native-safe-area-context';
import {SessionDataProvider} from ${path('client/src/api/session-data-provider.tsx')};
import SignInScreen from ${path('client/app/sign-in.tsx')};
import {ChatRoom} from ${path('client/src/chat/chat-room.tsx')};import {createChatTransport} from ${path('client/src/chat/chat-api.ts')};
import {createSafetyTransport} from ${path('client/src/safety/safety-api.ts')};
import {PalaceLiveSession} from ${path('client/src/realtime/palace-live-session.tsx')};import {palaceConnected} from ${path('client/src/realtime/palace-live-state.ts')};
import {voiceStorage} from ${path('client/src/voice/voice-storage.web.ts')};import {DraftController} from ${path('client/src/letters/draft.ts')};
import {createWorldDeliveryTransport} from ${path('client/src/infinity/infinity-api.ts')};import {WorldController} from ${path('client/src/infinity/world-controller.ts')};
const who=new URLSearchParams(location.search).get('who')==='bob'?'bob':'alice',token=async()=>who,noop=()=>{};
const sockets=()=>new WebSocket(${JSON.stringify(backend.url.replace('http:','ws:'))}+'/events/socket');
window.__voiceTest=async()=>{
const original=window.btoa;window.btoa=undefined;
try{const owner='owner-alice',clip={id:crypto.randomUUID(),mimeType:'audio/mp4',byteLength:${voiceBytes.length},durationMs:2000};
await voiceStorage.save(owner,clip,Uint8Array.from(${JSON.stringify(voiceBytes)}));
const saved=new Map(),draft=new DraftController(owner,{read:key=>saved.get(key)||null,write:(key,value)=>saved.set(key,value)});draft.openDesk();draft.choosePreset(${JSON.stringify(preset)});draft.changeKind('VOICE');draft.attachVoice(clip);draft.seal();
const api=createWorldDeliveryTransport(async()=>'alice',owner);let sends=0;const controller=new WorldController(draft,{...api,submit:async input=>{sends++;const receipt=await api.submit(input);throw Error('Synthetic lost reply');}},()=>crypto.randomUUID());
await controller.confirm();const pending=draft.getSnapshot().draft.stage;await controller.check();return {pending,stage:draft.getSnapshot().draft.stage,voice:draft.getSnapshot().draft.voice,cleanup:draft.getSnapshot().draft.voiceDeletes.length,sends};
}finally{window.btoa=original;}};
function App(){const owner='owner-'+who,peer=who==='alice'?'owner-bob':'owner-alice';const api=useMemo(()=>createChatTransport(token,()=>new WebSocket(${JSON.stringify(backend.url.replace('http:','ws:'))}+'/chat/socket')),[]);const safety=useMemo(()=>createSafetyTransport(token),[]);window.__connected=()=>palaceConnected(owner);return location.pathname==='/email'?<SignInScreen/>:<><PalaceLiveSession ownerId={owner} getToken={token} createSocket={sockets} chatPeerId={peer} onOpen={noop}/><ChatRoom ownerId={owner} peerId={peer} api={api} safety={safety} onBack={noop}/></>;}
AppRegistry.registerComponent('CorrespondenceReview',()=>()=> <SafeAreaProvider><SessionDataProvider><App/></SessionDataProvider></SafeAreaProvider>);AppRegistry.runApplication('CorrespondenceReview',{rootTag:document.getElementById('root')});
`;
const {createFsFromVolume,Volume}=require('memfs'),memory=createFsFromVolume(new Volume()),output=resolve(root,'.cache/virtual-correspondence');
const compiler=webpack({mode:'development',devtool:false,target:'web',context:root,entry:'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(entry,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).outputText).toString('base64'),output:{path:output,filename:'bundle.js'},resolve:{extensions:['.web.tsx','.tsx','.web.ts','.ts','.web.js','.js','.mjs','.json'],alias:{'@clerk/expo/legacy$':resolve(root,'scripts/email-signup-preview.ts'),'react-native$':mobileRequire.resolve('react-native-web'),react:dirname(mobileRequire.resolve('react/package.json')),'react-dom':dirname(mobileRequire.resolve('react-dom/package.json'))}},module:{rules:[{test:/\.tsx?$/,use:resolve(root,'scripts/preview-typescript-loader.cjs')},{test:/\.(png|jpg)$/,type:'asset/inline'}]},plugins:[new webpack.DefinePlugin({__DEV__:'true','process.env':JSON.stringify({NODE_ENV:'development',EXPO_OS:'web',EXPO_PUBLIC_API_URL:'https://api.example.invalid',EXPO_PUBLIC_WEB_API_URL:'https://api.example.invalid',EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:'pk_test_dGVzdC5jbGVyay5hY2NvdW50cy5kZXYk'}),'process.env.NODE_ENV':JSON.stringify('development')})],performance:{hints:false},stats:'errors-only'});compiler.outputFileSystem=memory;
let browser;const errors=[],captures=[];
try{
await new Promise((done,fail)=>compiler.run((error,stats)=>{compiler.close(()=>{});if(error||stats.hasErrors())fail(error||Error(stats.toString('errors-only').replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'preview-entry')));else done();}));
const {chromium}=require('../.cache/art-tools/node_modules/playwright');browser=await chromium.launch({headless:true,channel:'chrome'});const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});await context.grantPermissions(['local-network-access'],{origin:'http://127.0.0.1'});
async function open(url){const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin==='http://127.0.0.1')return route.fulfill(u.pathname==='/bundle.js'?{contentType:'text/javascript; charset=utf-8',body:memory.readFileSync(resolve(output,'bundle.js'))}:{contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;height:100%;width:100%}#root{display:flex}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'});if(u.origin==='https://api.example.invalid')return forwardFixtureApi(route,backend.url+u.pathname+u.search,page);return route.abort();});await page.goto('http://127.0.0.1'+url);return page;}
const email=await open('/email');const button=(page,name)=>page.getByRole('button',{name,exact:true});
await button(email,'New here? Create an account').click();await email.getByRole('checkbox',{name:'I am at least 13 years old'}).click();await email.getByRole('textbox',{name:'Email address',exact:true}).fill('synthetic@example.invalid');await button(email,'Send a verification code').click();await email.getByRole('textbox',{name:'Verification code'}).fill('123456');await button(email,'Continue').click();await email.getByText('One last step for your account',{exact:true}).waitFor();
assert.equal(await email.evaluate(()=>window.__emailPreview.activated),'');await email.getByRole('textbox',{name:'Password',exact:true}).fill('short');await button(email,'Complete my account').click();await email.getByText('Choose a longer password, with at least eight characters.',{exact:true}).waitFor();
await email.getByRole('textbox',{name:'Password',exact:true}).fill('synthetic-password-123');await button(email,'Complete my account').click();await email.waitForFunction(()=>window.__emailPreview.activated==='synthetic-session');assert.equal(await email.evaluate(()=>window.__emailPreview.emailAttempts),1);await email.close();
const alice=await open('/chat?who=alice'),bob=await open('/chat?who=bob');await Promise.all([alice.waitForFunction(()=>window.__connected()),bob.waitForFunction(()=>window.__connected())]);
async function send(text){await alice.getByRole('textbox',{name:'Your chat message',exact:true}).fill(text);await button(alice,'Send message').click();await bob.getByText(text,{exact:true}).waitFor();}
await send('A message to withdraw.');await button(alice,'Message options 1').click();await button(alice,'Unsend for everyone').click();await button(alice,'Keep message').click();assert.equal(backend.fixture.state.chatMessages[0].text,'A message to withdraw.');
await button(alice,'Message options 1').click();await button(alice,'Unsend for everyone').click();captures.push((await alice.screenshot({type:'jpeg',quality:75})).toString('base64'));await button(alice,'Confirm unsend').click();await bob.getByText('This message was unsent.',{exact:true}).waitFor();assert.equal(await bob.getByText('A message to withdraw.',{exact:true}).count(),0);
await send('A message to keep on one side.');await button(bob,'Message options 2').click();assert.equal(await button(bob,'Unsend for everyone').count(),0);await button(bob,'Delete for me').click();await button(bob,'Confirm delete for me').click();await bob.getByTestId('chat-message-2').waitFor({state:'detached'});await alice.getByText('A message to keep on one side.',{exact:true}).waitFor();await bob.reload();await bob.getByText('A conversation with @alice',{exact:true}).waitFor();assert.equal(await bob.getByText('A message to keep on one side.',{exact:true}).count(),0);
const voice=await alice.evaluate(()=>window.__voiceTest());assert.deepEqual(voice,{pending:'world-pending',stage:'published',voice:null,cleanup:1,sends:1});const published=backend.fixture.state.letters.find(letter=>letter.destinationType==='INFINITY');assert.equal(published.type,'VOICE');assert.equal(published.isSigned,false);assert.equal(published.moderationSkipped,true);assert.equal(published.moderationPassed,null);assert.equal(media.calls.filter(call=>call.kind==='put').length,2);
assert.deepEqual(errors,[]);console.log('PASS: email verification/required-details/retry; two live accounts unsend and delete independently; native-safe MP4 checksum/upload/publication and lost-reply receipt recovery.');if(process.argv.includes('--images'))for(const capture of captures)console.log('REVIEW_IMAGE:'+capture);
}finally{if(browser){for(const context of browser.contexts())for(const page of context.pages())await page.unrouteAll({behavior:'ignoreErrors'});await browser.close();}await backend.app.close();}
