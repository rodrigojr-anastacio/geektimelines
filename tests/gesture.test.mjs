import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_ZOOM, MAX_ZOOM, clampZoom, zoomAround, pinchZoom,
  flickVelocity, glideStep, centroid, FLICK_WINDOW_MS, MIN_FLICK_SPEED,
  clampView, isPinned, EDGE_MARGIN,
} from '../lib/gesture.ts';

test('zoom stays inside the usable range', () => {
  assert.equal(clampZoom(0.0001), MIN_ZOOM);
  assert.equal(clampZoom(99), MAX_ZOOM);
  assert.equal(clampZoom(1), 1);
});

test('zooming keeps the anchor point pinned', () => {
  const view = { k: 1, x: -200, y: -120 };
  const px = 400;
  const py = 300;
  // World coordinate currently under the cursor.
  const worldX = (px - view.x) / view.k;
  const worldY = (py - view.y) / view.k;
  for (const target of [0.3, 0.75, 1.8, 2.4]) {
    const next = zoomAround(view, target, px, py);
    assert.ok(Math.abs(next.x + worldX * next.k - px) < 1e-6, `x drifted at ${target}`);
    assert.ok(Math.abs(next.y + worldY * next.k - py) < 1e-6, `y drifted at ${target}`);
  }
});

test('zooming past the limits still does not drift', () => {
  const view = { k: 1, x: 50, y: 50 };
  const worldX = (300 - view.x) / view.k;
  const clamped = zoomAround(view, 500, 300, 300);
  assert.equal(clamped.k, MAX_ZOOM);
  assert.ok(Math.abs(clamped.x + worldX * clamped.k - 300) < 1e-6);
});

test('pinch scales in proportion to finger spread', () => {
  assert.equal(pinchZoom(0.6, 100, 200), 1.2);
  assert.equal(pinchZoom(0.6, 200, 100), 0.3);
  assert.equal(pinchZoom(0.6, 100, 100), 0.6);
});

test('pinch survives a degenerate distance instead of exploding', () => {
  assert.equal(pinchZoom(0.8, 0, 120), 0.8);
  assert.equal(pinchZoom(0.8, 120, 0), 0.8);
  assert.ok(Number.isFinite(pinchZoom(0.8, 0.0001, 900)));
});

test('pinch respects the zoom limits', () => {
  assert.equal(pinchZoom(2, 10, 10000), MAX_ZOOM);
  assert.equal(pinchZoom(0.2, 10000, 10), MIN_ZOOM);
});

test('a real flick produces velocity in the direction of travel', () => {
  const now = 1000;
  const samples = [0, 1, 2, 3, 4].map((i) => ({ t: now - 64 + i * 16, x: -i * 30, y: 0 }));
  const velocity = flickVelocity(samples, now);
  assert.ok(velocity, 'expected a flick');
  assert.ok(velocity.vx < 0, 'should carry to the left');
  assert.ok(Math.abs(velocity.vx) > MIN_FLICK_SPEED);
});

test('a slow drag does not glide', () => {
  const now = 1000;
  const samples = [0, 1, 2].map((i) => ({ t: now - 200 + i * 100, x: i * 2, y: 0 }));
  assert.equal(flickVelocity(samples, now), null);
});

test('holding still before release does not glide', () => {
  const now = 1000;
  const samples = [
    { t: now - 400, x: 0, y: 0 },
    { t: now - FLICK_WINDOW_MS - 50, x: -120, y: 0 },
  ];
  assert.equal(flickVelocity(samples, now), null);
});

test('degenerate sample sets are rejected rather than dividing by zero', () => {
  assert.equal(flickVelocity([], 0), null);
  assert.equal(flickVelocity([{ t: 5, x: 0, y: 0 }], 5), null);
  assert.equal(flickVelocity([{ t: 5, x: 0, y: 0 }, { t: 5, x: 90, y: 0 }], 5), null);
});

test('the glide decays and always terminates', () => {
  let velocity = { vx: -40, vy: 12 };
  let steps = 0;
  let previous = Math.hypot(velocity.vx, velocity.vy);
  while (true) {
    const next = glideStep(velocity);
    if (!next) break;
    const speed = Math.hypot(next.vx, next.vy);
    assert.ok(speed < previous, 'glide must slow down every step');
    previous = speed;
    velocity = next;
    if (++steps > 500) break;
  }
  assert.ok(steps > 5, 'glide ended too abruptly');
  assert.ok(steps < 500, 'glide never stopped');
});

test('centroid of one pointer is the pointer itself, with no spread', () => {
  const { midX, midY, distance } = centroid([{ x: 40, y: 90 }]);
  assert.equal(midX, 40);
  assert.equal(midY, 90);
  assert.equal(distance, 0);
});

test('centroid of two pointers sits between them with their spread', () => {
  const { midX, midY, distance } = centroid([{ x: 0, y: 0 }, { x: 60, y: 80 }]);
  assert.equal(midX, 30);
  assert.equal(midY, 40);
  assert.equal(distance, 100);
});

// ---------------------------------------------------------------- edges

test('you cannot drag past the left edge into empty space', () => {
  const world = { width: 6000, height: 2000 };
  const box = { width: 800, height: 600 };
  const dragged = clampView({ k: 1, x: 5000, y: 0 }, world, box);
  assert.ok(dragged.x <= EDGE_MARGIN, `x should stop near 0, got ${dragged.x}`);
});

test('you cannot drag past the right edge either', () => {
  const world = { width: 6000, height: 2000 };
  const box = { width: 800, height: 600 };
  const dragged = clampView({ k: 1, x: -99999, y: 0 }, world, box);
  assert.ok(dragged.x >= box.width - world.width - EDGE_MARGIN, `x overshot: ${dragged.x}`);
});

test('the clamp scales with the zoom level', () => {
  const world = { width: 6000, height: 2000 };
  const box = { width: 800, height: 600 };
  const zoomedOut = clampView({ k: 0.2, x: -99999, y: 0 }, world, box);
  const zoomedIn = clampView({ k: 1, x: -99999, y: 0 }, world, box);
  assert.ok(zoomedOut.x > zoomedIn.x, 'a smaller canvas should stop sooner');
  assert.ok(zoomedOut.x >= box.width - world.width * 0.2 - EDGE_MARGIN);
});

test('a canvas smaller than the viewport is centred, not shoved into a corner', () => {
  const world = { width: 400, height: 300 };
  const box = { width: 800, height: 600 };
  for (const attempt of [-5000, -1, 0, 42, 5000]) {
    const view = clampView({ k: 1, x: attempt, y: attempt }, world, box);
    assert.equal(view.x, 200);
    assert.equal(view.y, 150);
  }
});

test('clamping never changes the zoom level', () => {
  const view = clampView({ k: 0.37, x: -99999, y: 99999 }, { width: 6000, height: 2000 }, { width: 800, height: 600 });
  assert.equal(view.k, 0.37);
});

test('a view already inside the bounds is left untouched', () => {
  const world = { width: 6000, height: 2000 };
  const box = { width: 800, height: 600 };
  const view = { k: 1, x: -2000, y: -500 };
  assert.deepEqual(clampView(view, world, box), view);
});

test('non-finite coordinates are neutralised instead of propagating', () => {
  const view = clampView({ k: 1, x: NaN, y: Infinity }, { width: 6000, height: 2000 }, { width: 800, height: 600 });
  assert.ok(Number.isFinite(view.x) && Number.isFinite(view.y));
});

test('isPinned reports which axis is against a wall', () => {
  const world = { width: 6000, height: 2000 };
  const box = { width: 800, height: 600 };
  assert.deepEqual(isPinned({ k: 1, x: 9000, y: -400 }, world, box), { x: true, y: false });
  assert.deepEqual(isPinned({ k: 1, x: -2000, y: -400 }, world, box), { x: false, y: false });
});

test('a glide aimed at the wall is stopped by the clamp', () => {
  const world = { width: 6000, height: 2000 };
  const box = { width: 800, height: 600 };
  let view = { k: 1, x: -100, y: -400 };
  let velocity = { vx: 60, vy: 0 };
  for (let i = 0; i < 200; i++) {
    const next = glideStep(velocity);
    if (!next) break;
    velocity = next;
    view = clampView({ ...view, x: view.x + next.vx, y: view.y + next.vy }, world, box);
  }
  assert.ok(view.x <= EDGE_MARGIN, `glide escaped the canvas: ${view.x}`);
});
