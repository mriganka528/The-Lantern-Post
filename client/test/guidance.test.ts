import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GuidancePreference, guidancePlacement, guidanceSteps } from '../src/guidance/guidance-model';
import type { GuidanceOutcome } from '../src/guidance/guidance-model';

test('guidance is automatic once per installation, with explicit skip/finish and replay choices', () => {
  let saved: string | null = null;
  const values: string[] = [];
  const storage = { read: () => saved, write: (value: GuidanceOutcome) => { values.push(value); saved = value; } };
  const first = new GuidancePreference(storage);
  assert.equal(first.claimAutomatic(), true);
  assert.equal(saved, 'seen');
  assert.equal(first.claimAutomatic(), false);
  assert.equal(new GuidancePreference(storage).claimAutomatic(), false, 'an interrupted visit is not forced after a reload');
  first.mark('skipped');
  assert.equal(new GuidancePreference(storage).claimAutomatic(), false);
  first.mark('seen'); first.mark('complete');
  assert.equal(new GuidancePreference(storage).claimAutomatic(), false);
  assert.deepEqual(values, ['seen', 'skipped', 'seen', 'complete']);
  saved = null;
  assert.equal(new GuidancePreference(storage).claimAutomatic(), true, 'new installation has its own first visit');
});

test('storage problems do not trap the user or restart guidance repeatedly', () => {
  let unavailable = true; let value: string | null = null;
  const preference = new GuidancePreference({ read: () => value, write: next => { if (unavailable) throw Error('storage unavailable'); value = next; } });
  assert.equal(preference.claimAutomatic(), true);
  assert.equal(preference.needsRetry, true);
  assert.equal(preference.claimAutomatic(), false);
  assert.equal(preference.mark('skipped'), false);
  unavailable = false;
  assert.equal(preference.retry(), true);
  assert.equal(value, 'skipped');
  assert.equal(preference.needsRetry, false);
  const unreadable = new GuidancePreference({ read: () => { throw Error('storage unavailable'); }, write: () => {} });
  assert.equal(unreadable.claimAutomatic(), false);
  assert.equal(unreadable.mark('seen'), true, 'explicit replay stays available');
});

test('a future or unfamiliar saved marker is not mistaken for a new installation', () => {
  const preference = new GuidancePreference({ read: () => 'future-version-marker', write: () => assert.fail('must preserve the existing choice') });
  assert.equal(preference.claimAutomatic(), false);
});

test('spotlights, pointers and captions fit phone/tablet safe areas without overlap after scrolling', () => {
  for (const [width, height] of [[320,568],[390,844],[844,390],[768,1024],[1440,900]] as const) {
    for (const rect of [{x:22,y:46,width:width-44,height:190},{x:width-70,y:60,width:44,height:44},{x:18,y:height-110,width:230,height:68}]) {
      for (const fontScale of [1,1.6,2]) {
        const {focus,panel,pointerX,side} = guidancePlacement(rect,{width,height,top:24,bottom:20},fontScale);
        for (const box of [focus,panel]) {
          assert.ok(box.x >= 0 && box.y >= 24);
          assert.ok(box.x+box.width <= width && box.y+box.height <= height-20);
          assert.ok(box.width > 0 && box.height > 0);
        }
        assert.ok(side === 'below' ? panel.y >= focus.y+focus.height : panel.y+panel.height <= focus.y);
        assert.ok(pointerX >= panel.x && pointerX <= panel.x+panel.width);
      }
    }
  }
  assert.equal(new Set(guidanceSteps.map(step => step.id)).size, guidanceSteps.length);
});
