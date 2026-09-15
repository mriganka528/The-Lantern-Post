import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createNativeRecorderDriver } from '../src/voice/native-recorder-session';
import type { NativeRecorderPort } from '../src/voice/native-recorder-session';
import { RecorderController } from '../src/voice/recorder-controller';
import type { VoiceStore } from '../src/voice/voice-contract';

function deferred<T>() { let resolve!: (value:T)=>void;const promise=new Promise<T>(done=>{resolve=done;});return{promise,resolve}; }
function fixture() {
  const calls:string[]=[];let recording=false;let elapsed=0;let foreground=true;
  const port:NativeRecorderPort={hasPermission:async()=>false,requestPermission:async()=>true,foreground:async()=>foreground,isForeground:()=>foreground,
    enableAudio:async()=>{calls.push('enable');},disableAudio:async()=>{calls.push('disable');},
    create:()=>{calls.push('create');return{prepare:async()=>{calls.push('prepare');},record:()=>{recording=true;calls.push('record');},stop:async()=>{recording=false;calls.push('stop');},release:()=>{calls.push('release');},
      uri:()=>'owned-cache.m4a',status:()=>({isRecording:recording,durationMillis:elapsed}),listen:()=>()=>{calls.push('unsubscribe');}};},
    read:async()=>{calls.push('read');return new Uint8Array(800);},remove:()=>{calls.push('remove');}};
  return{calls,port,time:(value:number)=>{elapsed=value;},background:()=>{foreground=false;}};
}
test('native microphone permission may background the activity without cancelling its own consent sheet', async()=>{
  const f=fixture(),permission=deferred<boolean>();f.port.requestPermission=()=>permission.promise;
  const driver=createNativeRecorderDriver(f.port);let saved=false;
  const store:VoiceStore={save:async()=>{saved=true;},remove:async()=>{},read:async()=>new Uint8Array(),playback:async()=>({uri:'',release:()=>{}}),sha256:async()=>''};
  const controller=new RecorderController(driver,store,'owner',()=>true,()=> '12345678-1234-4234-8234-123456789abc');
  const starting=controller.start();await Promise.resolve();controller.background();assert.equal(controller.getSnapshot().phase,'permission');
  permission.resolve(true);await starting;assert.equal(controller.getSnapshot().phase,'recording');
  f.time(1500);await controller.stop();assert.equal(saved,true);assert.equal(controller.getSnapshot().phase,'idle');
  assert.equal(f.calls.filter(c=>c==='release').length,1);assert.equal(f.calls.filter(c=>c==='remove').length,1);controller.dispose();
});
test('permission granted after leaving never creates a recorder, and a background result cannot capture', async()=>{
  for(const abortAfter of [true,false]){const f=fixture(),permission=deferred<boolean>(),abort=new AbortController();f.port.requestPermission=()=>permission.promise;
    const driver=createNativeRecorderDriver(f.port);const pending=driver.start(()=>{},()=>{},abort.signal);
    if(abortAfter)abort.abort();else f.background();permission.resolve(true);
    await assert.rejects(pending);assert.equal(f.calls.includes('create'),false);assert.equal(driver.permissionPromptActive?.(abort.signal),false);
  }
});
test('native capture is exclusive, stops once and restores audio on preparation failure',async()=>{
  const f=fixture(),driver=createNativeRecorderDriver(f.port);const capture=await driver.start(()=>{},()=>{},new AbortController().signal);
  await assert.rejects(driver.start(()=>{},()=>{},new AbortController().signal));f.time(2100);
  const [a,b]=await Promise.all([capture.stop(),capture.stop()]);capture.cancel();assert.equal(a,b);assert.equal(a.durationMs,2100);assert.equal(f.calls.filter(c=>c==='stop').length,1);
  const failed=fixture();const original=failed.port.create;failed.port.create=()=>({...original(),prepare:async()=>{throw Error('device failure');}});
  await assert.rejects(createNativeRecorderDriver(failed.port).start(()=>{},()=>{},new AbortController().signal));
  assert.ok(failed.calls.includes('release'));assert.ok(failed.calls.includes('remove'));assert.ok(failed.calls.includes('disable'));
});

test('checking an already granted permission cannot exempt a real background transition',async()=>{
  const f=fixture(),permission=deferred<boolean>(),abort=new AbortController();f.port.hasPermission=()=>permission.promise;
  const driver=createNativeRecorderDriver(f.port);const pending=driver.start(()=>{},()=>{},abort.signal);
  assert.equal(driver.permissionPromptActive?.(abort.signal),false);abort.abort();permission.resolve(true);
  await assert.rejects(pending);assert.equal(f.calls.includes('create'),false);
});
