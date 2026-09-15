// Synthetic catalogue only. Compile into memory; no credentials, API sends or
// generated files. --web checks the unchanged web-modal mode as well.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url), mobileRequire = createRequire(resolve(root, 'client/package.json'));
const ts = require('typescript'), webpack = require('webpack');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, file);
const { serializeCharacter, characterKeys } = require('../server/src/characters/catalog.ts');
const names = ['Ember', 'Lune', 'Orion', 'Flora', 'Celeste', 'Sol', 'Aurelia', 'Seraph', 'Aurel', 'Jade'];
const characters = characterKeys.map((key, index) => serializeCharacter({ id: 'char_' + key, key, displayName: names[index], assetUrl: 'bundled://characters/' + key }));
const native = !process.argv.includes('--web');
const path = file => JSON.stringify(resolve(root, file).replaceAll('\\', '/'));
const source = `
import React,{useEffect,useState} from 'react';
import {AppRegistry,View} from 'react-native';
import {SafeAreaProvider,SafeAreaInsetsContext} from 'react-native-safe-area-context';
import {CharacterGallery} from ${path('client/src/storybook/character-gallery.tsx')};
import {PalaceHome} from ${path('client/src/storybook/palace-home.tsx')};
import {PalaceGuidanceProvider} from ${path('client/src/guidance/guidance-provider.tsx')};
import {BellContext} from ${path('client/src/notifications/bell-context.ts')};
import {useTourGuide} from '@wrack/react-native-tour-guide';
const characters=${JSON.stringify(characters)};
const top=Number(new URLSearchParams(location.search).get('top')||0);
window.__ux={calls:0,failNext:false};
function Probe(){const t=useTourGuide();useEffect(()=>{window.__ux.tour={id:t.activeSteps[t.currentStep]?.id,title:t.activeSteps[t.currentStep]?.title,layout:t.targetLayout,config:t.config};});return null;}
function Fixture(){
const [saved,setSaved]=useState(()=>characters.find(c=>c.id===localStorage.getItem('fixture-character'))||null);
const [screen,setScreen]=useState(()=>saved?'home':'gallery');const [busy,setBusy]=useState(false),[error,setError]=useState(null);
window.__ux.screen=screen;window.__ux.saved=saved?.id;window.__ux.setScreen=setScreen;
function choose(c){if(busy)return;if(c.id===saved?.id){setScreen('home');return;}window.__ux.calls++;setBusy(true);setError(null);setTimeout(()=>{if(window.__ux.failNext){window.__ux.failNext=false;setBusy(false);setError('The palace could not be prepared. Please try again.');return;}setSaved(c);localStorage.setItem('fixture-character',c.id);setTimeout(()=>{setScreen('home');setBusy(false);},120);},100);}
return <View style={{flex:1,paddingTop:top,paddingBottom:${native?24:0},backgroundColor:'#F8F4EA'}}><SafeAreaInsetsContext.Provider value={{top:${native?'top?0:28':'0'},bottom:${native?24:0},left:0,right:0}}><PalaceGuidanceProvider enabled={screen==='home'}><Probe/><BellContext.Provider value={{unseen:0,openBell:()=>{},markItemSeen:()=>{}}}>
{saved&&<View style={{flex:1,display:screen==='home'?'flex':'none'}}><PalaceHome key={saved.id} active={screen==='home'} character={saved} username="story_guest" onAccount={()=>{}} onCompanions={()=>setScreen('gallery')} onWrite={()=>{}} onFriends={()=>{}} onInbox={()=>{}} onInfinity={()=>{}}/></View>}
{screen==='gallery'&&<CharacterGallery currentId={saved?.id} characters={characters} busy={busy} error={error} onChoose={choose} onAccount={()=>{}} onBack={saved?()=>setScreen('home'):undefined}/>}
</BellContext.Provider></PalaceGuidanceProvider></SafeAreaInsetsContext.Provider></View>;
}
AppRegistry.registerComponent('PalaceReview',()=>()=> <SafeAreaProvider><Fixture/></SafeAreaProvider>);
AppRegistry.runApplication('PalaceReview',{rootTag:document.getElementById('root')});
`;
const { createFsFromVolume, Volume } = require('memfs');
const memory = createFsFromVolume(new Volume()), output = resolve(root, '.cache/virtual-palace-review');
const compiler = webpack({ mode: 'development', devtool: false, target: 'web', context: root,
  entry: 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext } }).outputText).toString('base64'),
  output: { path: output, filename: 'bundle.js' },
  resolve: { extensions: ['.web.tsx','.tsx','.web.ts','.ts','.web.js','.js','.mjs','.json'], alias: { 'react-native$': native ? resolve(root,'scripts/android-tour-preview.cjs') : mobileRequire.resolve('react-native-web'), react: dirname(mobileRequire.resolve('react/package.json')), 'react-dom': dirname(mobileRequire.resolve('react-dom/package.json')) } },
  module: { rules: [{ test: /\.tsx?$/, use: resolve(root,'scripts/preview-typescript-loader.cjs') }, { test: /\.(png|jpg)$/, type: 'asset/inline' }] },
  plugins: [new webpack.DefinePlugin({ __DEV__: 'true', 'process.env.NODE_ENV': JSON.stringify('development'), 'process.env.EXPO_OS': JSON.stringify('web') })],
  performance: { hints: false }, stats: 'errors-only',
});
compiler.outputFileSystem = memory;
let browser; const captures=[];
try {
  await new Promise((done, fail) => compiler.run((error, stats) => { compiler.close(()=>{}); if (error || stats.hasErrors()) fail(error || Error(stats.toString('errors-only').replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'preview-entry'))); else done(); }));
  const { chromium } = require('../.cache/art-tools/node_modules/playwright');
  browser = await chromium.launch({ headless: true, channel: process.env.STORYBOOK_BROWSER_CHANNEL || 'chrome' });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage(), errors=[];
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => { const url=new URL(route.request().url()); if(url.origin!=='http://127.0.0.1')return route.abort();return route.fulfill(url.pathname==='/bundle.js'?{contentType:'text/javascript; charset=utf-8',body:memory.readFileSync(resolve(output,'bundle.js'))}:{contentType:'text/html; charset=utf-8',body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#root{margin:0;height:100%;width:100%}#root{display:flex}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'}); });
  const button=name=>page.getByRole('button',{name,exact:true});
  await page.goto('http://127.0.0.1');
  await page.evaluate(()=>localStorage.setItem('lantern-guidance-v1','skipped'));
  await page.getByRole('radio',{name:/^Orion,/}).click();
  await button('Go with Orion').waitFor();assert.equal(await page.evaluate(()=>window.__ux.calls),0);
  for(const size of [{width:320,height:740},{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(size);
    for(const label of ['Go with Orion','Select another companion']){const r=await button(label).boundingBox();assert.ok(r.height>=44&&r.y>=0&&r.y+r.height<=size.height&&r.x>=0&&r.x+r.width<=size.width,'confirmation stays reachable: '+label);}
  }
  await page.setViewportSize({width:390,height:844});
  captures.push((await page.screenshot({type:'jpeg',quality:80})).toString('base64'));
  await button('Select another companion').click();assert.equal(await page.evaluate(()=>window.__ux.calls),0);
  for(const [i,name] of ['Ember','Lune','Orion'].entries()){
    await page.getByRole('radio',{name:new RegExp('^'+name+',')}).click();
    if(i===1){await page.evaluate(()=>{window.__ux.failNext=true;});await button('Go with Lune').click();await page.getByRole('alert').filter({hasText:'could not be prepared'}).waitFor();assert.equal(await page.evaluate(()=>window.__ux.saved),'char_fox-lantern');}
    await button('Go with '+name).click();
    await page.waitForFunction(()=>window.__ux.screen==='home');
    assert.equal(await button('Open the doors').count(),1,'one entrance after selecting '+name);
    await button('Open the doors').click();
    await button('Open the doors').waitFor({state:'detached',timeout:4000});
    await button('Skip the walk').waitFor({state:'detached',timeout:5000});
    assert.equal(await button('Open the doors').count(),0,'first press finishes the only gate');
    if(i<2)await button('Companions').click();
  }
  assert.equal(await page.evaluate(()=>window.__ux.calls),4,'only confirmed choices and explicit retry save');
  // Fresh first-visit marker, then inspect every real library target.
  await page.evaluate(()=>localStorage.removeItem('lantern-guidance-v1'));
  await page.reload();await button('Skip to my palace').click();
  const steps=['companions','writing','friends','letterbox','infinity','fire','bell','account','guidance'];
  for(const top of (native?[0,28]:[0])){
    if(top){await page.goto('http://127.0.0.1/?top='+top);await button('Skip to my palace').click();await button('Start guidance').click();}
    for(const [i,id] of steps.entries()){
      await page.locator('#guidance-step-'+id).waitFor();
      await page.waitForFunction(({id,native})=>{const t=window.__ux.tour;if(t?.id!==id||!t.layout)return false;const target=document.getElementById('guidance-target-'+id)?.getBoundingClientRect();const origin=native?document.querySelector('[data-testid="palace-guidance-overlay"]').getBoundingClientRect().top:0;return target&&Math.abs(t.layout.y+origin-target.y)<=2&&Math.abs(t.layout.x-target.x)<=2&&Math.abs(t.layout.height-target.height)<=2;},{id,native},{timeout:5000});
      const title=await page.evaluate(()=>window.__ux.tour.title);const box=await page.getByText(title,{exact:true}).boundingBox();assert.ok(box.y>=0&&box.y+box.height<=844,'tooltip fits '+id);
      // The library's 180-ms fade briefly contains both old and new masks.
      // Inspect the settled overlay, rather than an intentional transition.
      await page.waitForTimeout(220);
      if(top===0&&(id==='companions'||id==='bell'))captures.push((await page.screenshot({type:'jpeg',quality:80})).toString('base64'));
      await button(i===8?'Finish guidance':'Next guidance step').click();
    }
  }
  await button('Start guidance').click();await page.getByTestId('palace-guidance').waitFor();
  if(native)assert.equal(await page.evaluate(()=>window.__androidBack()),true);else await button('Skip guidance').click();
  await page.getByTestId('palace-guidance').waitFor({state:'detached'});assert.equal(await page.evaluate(()=>localStorage.getItem('lantern-guidance-v1')),'skipped');
  assert.deepEqual(errors,[]);
  console.log('PASS '+(native?'Android-coordinate':'web')+' preview: nine aligned targets; cached-home gate round trips; one-tap opening; fixed confirmation actions; cancel/error/retry; Back/Skip.');
  if(process.argv.includes('--images'))for(const capture of captures)console.log('REVIEW_IMAGE:'+capture);
} finally { await browser?.close(); }
