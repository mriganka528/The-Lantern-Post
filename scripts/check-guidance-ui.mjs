import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function checkGuidance({ page, output, errors, requests, backend }) {
  const button = name => page.getByRole('button', { name, exact: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByText('Welcome home, alice.', { exact: true }).waitFor();
  assert.equal(await page.getByTestId('palace-guidance').count(), 0, 'tour waits for the palace entrance');
  await button('Skip to my palace').click();
  await page.getByTestId('palace-guidance').waitFor();
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByTestId('palace-guidance').waitFor({ state: 'detached' });
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.getByTestId('palace-guidance').waitFor();
  assert.equal(await button('Guidance').count(), 0, 'guidance is absent from the top navigation');
  const steps = ['companions','writing','friends','letterbox','infinity','fire','bell','account','guidance'];
  async function checkTarget(id) {
    await page.locator('#guidance-step-' + id).waitFor();
    await page.waitForFunction(id => {
      const target=document.getElementById('guidance-target-'+id)?.getBoundingClientRect();
      const focus=window.__phase10.tour?.layout;
      return window.__phase10.tour?.id===id&&target&&focus&&Math.abs(focus.x-target.x)<40&&Math.abs(focus.y-target.y)<40;
    },id).catch(async error=>{await page.screenshot({path:resolve(output,'tour-failure.png')});console.log(await page.evaluate(id=>({tour:window.__phase10.tour,target:document.getElementById('guidance-target-'+id)?.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight]}),id));throw error;});
    const title=await page.evaluate(()=>window.__phase10.tour.title);
    const box=await page.getByText(title,{exact:true}).boundingBox();
    assert.ok(box.x>=0&&box.x+box.width<=page.viewportSize().width+1&&box.y>=0&&box.y+box.height<=page.viewportSize().height+1,id+': title fits viewport');
    assert.ok((await button('Skip guidance').boundingBox()).height >= 44);
  }
  for (let i = 0; i < steps.length; i++) {
    await checkTarget(steps[i]);
    if (i === 0) { assert.equal(await button('Previous guidance step').count(), 0); await page.screenshot({ path: resolve(output,'01-companion-pointer.png') }); }
    if (steps[i] === 'infinity') await page.screenshot({ path: resolve(output,'02-world-pointer.png') });
    if (i === 2) { await button('Previous guidance step').click(); await checkTarget('writing'); await button('Next guidance step').click(); await checkTarget('friends'); }
    await button(i === steps.length - 1 ? 'Finish guidance' : 'Next guidance step').click();
  }
  assert.equal(await page.evaluate(() => localStorage.getItem('lantern-guidance-v1')), 'complete');
  await page.getByTestId('palace-guidance').waitFor({state:'detached'});
  const writes = () => requests.filter(r => ['POST','PUT','PATCH','DELETE'].includes(r.method) && !r.path.startsWith('/diagnostics'));
  assert.deepEqual(writes(), [], 'tour does not send, record, publish or modify an account');

  await page.reload(); await button('Skip to my palace').click(); await page.waitForTimeout(650);
  assert.equal(await page.getByTestId('palace-guidance').count(), 0, 'finishing persists over reload');
  await button('Start guidance').click(); await checkTarget('companions');
  await button('Skip guidance').click();
  assert.equal(await page.evaluate(() => localStorage.getItem('lantern-guidance-v1')), 'skipped');
  await page.reload(); await button('Skip to my palace').click(); await page.waitForTimeout(600);
  assert.equal(await page.getByTestId('palace-guidance').count(),0,'skipping persists over reload');
  await button('Account').click(); await button('Replay palace guidance').click(); await checkTarget('companions');
  assert.equal(await page.getByRole('heading',{name:'Your little corner',exact:true}).count(),0,'account dialog closes before the tour');
  for (const width of [320,360,768,1440]) {
    await page.setViewportSize({width,height:800}); await checkTarget('companions');
    await page.screenshot({path:resolve(output,`03-guidance-${width}.png`)});
  }
  await page.setViewportSize({width:844,height:390}); await checkTarget('companions');
  await button('Next guidance step').click(); await checkTarget('writing');
  await page.screenshot({path:resolve(output,'04-landscape-guidance.png')});
  await page.keyboard.press('Escape');
  await page.getByTestId('palace-guidance').waitFor({state:'detached'});
  assert.equal(await page.evaluate(() => localStorage.getItem('lantern-guidance-v1')), 'skipped', 'Escape uses the same persisted skip action');
  await page.setViewportSize({width:390,height:844});
  await button('Start guidance').click(); await checkTarget('companions');
  await button('Skip guidance').click();
  await button('Start guidance').click(); await checkTarget('companions');
  await page.evaluate(() => window.__phase10.setScreen('writing'));
  await page.getByTestId('palace-guidance').waitFor({state:'detached'});
  await page.getByRole('textbox',{name:'Your letter',exact:true}).fill('This unfinished letter stays exactly here.');
  await page.evaluate(() => window.__phase10.setScreen('home'));
  await button('Skip to my palace').click(); await page.waitForTimeout(600);
  assert.equal(await page.getByTestId('palace-guidance').count(),0,'route exit does not force the guide to resume');
  await button('Start guidance').click(); await checkTarget('companions'); await button('Skip guidance').click();
  await page.getByRole('button',{name:/Open the writing desk/}).click();
  assert.equal(await page.getByRole('textbox',{name:'Your letter',exact:true}).inputValue(),'This unfinished letter stays exactly here.');
  await page.evaluate(() => window.__phase10.setScreen('home')); await button('Skip to my palace').click();
  await button('Start guidance').click(); await checkTarget('companions');
  await page.evaluate(() => window.__phase10.setOwner('bob'));
  await page.getByText('Welcome home, bob.',{exact:true}).waitFor();
  await page.getByTestId('palace-guidance').waitFor({state:'detached'});
  await button('Skip to my palace').click(); await page.waitForTimeout(600);
  assert.equal(await page.getByTestId('palace-guidance').count(),0,'a different account does not restart an installation preference');
  assert.deepEqual(writes(),[]);
  await button('Account').click();
  await page.getByText('Your account & keepsakes',{exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'05-organized-account.png')});
  await button('Close dialog').last().click();
  await page.evaluate(()=>window.__phase10.setScreen('friends'));
  await button('Unfriend alice').click();
  await page.getByText('Unfriend alice?',{exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'06-unfriend-confirmation.png')});
  await button('Keep friendship').click();assert.equal(writes().length,0);
  await button('Unfriend alice').click();await button('Confirm unfriend').click();
  await page.getByText('The friendship has been closed. Your letters have not been deleted.',{exact:true}).waitFor();
  assert.equal(await button('Unfriend alice').count(),0);
  assert.equal(backend.fixture.state.blocks.length,0);
  assert.equal(writes().length,1);assert.match(writes()[0].path,/\/friends\/.+\/remove$/);
  assert.deepEqual(errors,[]);
  console.log('Guidance checks passed: one automatic palace visit; nine real targets; Back/Next/Finish/Skip; persisted choices and replay; 320–1440px and landscape pointers; account-modal handoff; background/foreground and identity cancellation; route exit and draft preservation; organized account menu; confirmed unfriend without blocking; no tour sends.');
}
