import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clampCamera, pinchCamera, RealmCamera, realmScale, zoomAt } from '../src/letters/realm-camera';

test('zoom preserves the world point under the pointer when it is not at a boundary', () => {
  const before = { zoom: 1, x: 0, y: 0 };
  const anchor = { x: 620, y: 350 };
  const after = zoomAt(before, 2, anchor, 1000, 625);
  const scale = realmScale(1000, 625);
  const pointBefore = { x: (anchor.x - 500 - before.x) / scale, y: (anchor.y - 312.5 - before.y) / scale };
  const pointAfter = { x: (anchor.x - 500 - after.x) / (scale * after.zoom), y: (anchor.y - 312.5 - after.y) / (scale * after.zoom) };
  assert.deepEqual(pointAfter, pointBefore);
});

test('camera bounds prevent blank space and clamp unsupported zooms or coordinates', () => {
  const result = clampCamera({ zoom: 100, x: 1e9, y: -1e9 }, 1000, 625);
  assert.deepEqual(result, { zoom: 3, x: 1000, y: -625 });
  assert.deepEqual(clampCamera({ zoom: NaN, x: Infinity, y: NaN }, 1000, 625), { zoom: 1, x: 0, y: 0 });
  assert.equal(clampCamera({ zoom: -.5, x: 0, y: 0 }, 350, 390).zoom, 1);
});

test('a two-finger pinch combines scale and midpoint movement', () => {
  const result = pinchCamera({ zoom: 1, x: 0, y: 0 }, [{ x: 450, y: 280 }, { x: 550, y: 280 }], [{ x: 430, y: 320 }, { x: 630, y: 320 }], 1000, 600);
  assert.deepEqual(result, { zoom: 2, x: 30, y: 60 });
  assert.deepEqual(pinchCamera({ zoom: 1, x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 0, y: 0 }], [{ x: 4, y: 4 }, { x: 8, y: 8 }], 1000, 600), { zoom: 1, x: 0, y: 0 });
});

test('touch-count changes do not jump the camera and reset cancels an active gesture', () => {
  const camera = new RealmCamera(); camera.resize(1000, 625); camera.zoomTo(2);
  camera.begin([{ x: 500, y: 300 }]); camera.move([{ x: 550, y: 320 }]);
  assert.equal(camera.getSnapshot().x, 50);
  const before = camera.getSnapshot();
  camera.move([{ x: 550, y: 320 }, { x: 650, y: 320 }]);
  assert.equal(camera.getSnapshot().x, before.x); assert.equal(camera.getSnapshot().zoom, before.zoom);
  camera.reset(); camera.move([{ x: 10, y: 10 }, { x: 700, y: 700 }]);
  assert.equal(camera.getSnapshot().zoom, 1); assert.equal(camera.getSnapshot().x, 0);
});

test('focus controls centre the chosen subject and resize keeps the view bounded', () => {
  const camera = new RealmCamera(); camera.resize(350, 390); camera.focus({ x: 800, y: 675 }, 2.35);
  assert.equal(camera.getSnapshot().zoom, 2.35);
  assert.ok(camera.getSnapshot().y < 0);
  camera.resize(1100, 650);
  const state = camera.getSnapshot();
  assert.deepEqual({ x: state.x, y: state.y, zoom: state.zoom }, clampCamera(state, 1100, 650));
  camera.resize(Infinity, 0); assert.equal(camera.getSnapshot().width, 1100);
});
