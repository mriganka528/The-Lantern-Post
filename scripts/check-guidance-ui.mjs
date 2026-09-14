import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export async function checkGuidance({ page, output, errors, requests }) {
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
  const steps = ['companions','writing','friends','letterbox','infinity','fire','bell','account','guidance'];
  async function checkTarget(id) {
    await page.locator('#guidance-step-' + id).waitFor();
    await page.getByTestId('guidance-highlight').waitFor();
    await page.waitForFunction(id => {
      const target = document.getElementById('guidance-target-' + id)?.getBoundingClientRect();
      const focus = document.querySelector('[data-testid="guidance-highlight"]')?.getBoundingClientRect();
      return target && focus && focus.left <= target.right && focus.right >= target.left && focus.top <= target.bottom && focus.bottom >= target.top;
    }, id);
    const boxes = await page.getByTestId('guidance-caption').evaluate(node => {
      const panel = node.getBoundingClientRect(); const focus = document.querySelector('[data-testid="guidance-highlight"]').getBoundingClientRect();
      return { x: panel.x, y: panel.y, right: panel.right, bottom: panel.bottom, focusTop: focus.top, focusBottom: focus.bottom, width: innerWidth, height: innerHeight };
    });
    assert.ok(boxes.x >= 0 && boxes.right <= boxes.width + 1 && boxes.y >= 0 && boxes.bottom <= boxes.height + 1, id + ': caption fits viewport');
    assert.ok(boxes.bottom <= boxes.focusTop + 1 || boxes.y >= boxes.focusBottom - 1, id + ': caption does not cover the highlighted section');
    assert.ok((await button('Skip guidance').boundingBox()).height >= 44);
  }
  for (let i = 0; i < steps.length; i++) {
    await checkTarget(steps[i]);
    if (i === 0) { assert.equal(await button('Previous guidance step').isDisabled(), true); await page.screenshot({ path: resolve(output,'01-companion-pointer.png') }); }
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
  await button('Guidance').click(); await checkTarget('companions');
  await button('Skip guidance').click();
  await button('Guidance').click(); await checkTarget('companions');
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
  await button('Guidance').click(); await checkTarget('companions');
  await page.evaluate(() => window.__phase10.setOwner('bob'));
  await page.getByText('Welcome home, bob.',{exact:true}).waitFor();
  await page.getByTestId('palace-guidance').waitFor({state:'detached'});
  await button('Skip to my palace').click(); await page.waitForTimeout(600);
  assert.equal(await page.getByTestId('palace-guidance').count(),0,'a different account does not restart an installation preference');
  assert.deepEqual(writes(),[]);
  assert.deepEqual(errors,[]);
  console.log('Guidance checks passed: one automatic palace visit; nine real targets; Back/Next/Finish/Skip; persisted choices and replay; 320–1440px and landscape pointers; account-modal handoff; background/foreground and identity cancellation; route exit and draft preservation; no sends or private changes.');
}
