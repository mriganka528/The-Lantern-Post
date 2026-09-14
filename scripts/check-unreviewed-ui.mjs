import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { forwardFixtureApi } from './browser-api-proxy.mjs';
export async function checkUnreviewed({page,backend,output,errors,requests}) {
  const button=(p,name)=>p.getByRole('button',{name,exact:true});
  await page.getByText('Welcome home, alice.',{exact:true}).waitFor();await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>window.__phase10.setScreen('chat'));await page.getByRole('textbox',{name:'Your chat message',exact:true}).fill('A normal chat with no automated moderation.');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Send message"]') && document.querySelector('[aria-label="Send message"]').getAttribute('aria-disabled')!=='true');await button(page,'Send message').click();await page.getByTestId('chat-transcript').getByText('A normal chat with no automated moderation.',{exact:true}).waitFor();
  const context=await page.context().browser().newContext({viewport:{width:390,height:844}});const bob=await context.newPage();
  try{
    bob.on('pageerror',error=>errors.push(error.message));await bob.route(/^https?:\/\//,async route=>{const url=new URL(route.request().url());if(url.origin!=='https://api.example.invalid')return route.abort();return forwardFixtureApi(route,backend.url+url.pathname+url.search,bob);});
    const url=new URL(page.url());url.search='?owner=bob&screen=chat';await bob.goto(url.href);await bob.getByText('A normal chat with no automated moderation.',{exact:true}).waitFor();
    await bob.getByRole('textbox',{name:'Your chat message',exact:true}).fill('A socket reply from the other palace.');await button(bob,'Send message').click();await page.getByText('A socket reply from the other palace.',{exact:true}).waitFor({timeout:5000});
    assert.equal(backend.fixture.state.chatMessages.length,2);assert.ok(backend.fixture.state.chatMessages.every(m=>m.moderationSkipped===true&&m.moderationPassed===null));await bob.screenshot({path:resolve(output,'01-chat-no-moderation-phone.png')});
  }finally{await bob.unrouteAll({behavior:'ignoreErrors'});await context.close();}
  await page.evaluate(()=>window.__phase10.setScreen('writing'));await page.getByRole('textbox',{name:'Your letter',exact:true}).fill('A private letter delivered without a provider.');await button(page,'Seal my letter').click();await button(page,"Send to a friend's gate").click();await page.getByRole('radio',{name:'Send to bob',exact:true}).click();
  await button(page,'Send my letter to bob').click();await button(page,'Return to my palace').waitFor({timeout:10000});assert.ok(backend.fixture.state.letters.some(l=>l.destinationType==='FRIEND'&&l.moderationSkipped&&l.moderationPassed===null));
  await button(page,'Return to my palace').click();await page.evaluate(()=>window.__phase10.setScreen('writing'));await page.getByRole('textbox',{name:'Your letter',exact:true}).fill('A public light with no automated review.');await button(page,'Seal my letter').click();await button(page,'Send to the Infinity World').click();await button(page,'Share my letter publicly').click();await button(page,'Explore the Infinity World').waitFor({timeout:10000});
  const star=backend.fixture.state.letters.find(l=>l.destinationType==='INFINITY');assert.ok(star);assert.equal(star.moderationPassed,null);assert.equal(star.moderationSkipped,true);assert.equal(star.isSigned,false);star.posX=800;star.posY=440;
  await button(page,'Explore the Infinity World').click();await page.getByTestId('world-star-'+star.id).click();await page.getByText('A public light with no automated review.',{exact:true}).waitFor();await page.screenshot({path:resolve(output,'02-public-letter-no-moderation.png')});
  assert.equal(requests.filter(r=>r.method==='POST'&&r.path==='/letters').length,2);assert.deepEqual(errors,[]);console.log('Unreviewed delivery browser checks passed: enabled send controls, actual socket chat between accounts, private courier delivery, public star publication/reading, no fake moderator and explicit unreviewed records.');
}
