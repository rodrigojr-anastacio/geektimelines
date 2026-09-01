import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeLayout, edgePath, NODE_W, NODE_H, MIN_GAP } from '../lib/layout.ts';

const universe = JSON.parse(fs.readFileSync('data/mcu.json', 'utf8'));
const { entries, tracks } = universe;

for (const mode of ['story', 'release']) {
  test(`[${mode}] every entry gets a position`, () => {
    const layout = computeLayout(entries, tracks, mode);
    for (const entry of entries) {
      assert.ok(layout.placed.has(entry.id), `${entry.id} was not placed`);
    }
  });

  test(`[${mode}] cards never overlap inside a track row`, () => {
    const layout = computeLayout(entries, tracks, mode);
    const rows = new Map();
    for (const entry of entries) {
      const spot = layout.placed.get(entry.id);
      const key = `${entry.track}:${spot.y}`;
      if (!rows.has(key)) rows.set(key, []);
      rows.get(key).push({ id: entry.id, x: spot.x });
    }
    for (const [key, list] of rows) {
      list.sort((a, b) => a.x - b.x);
      for (let i = 1; i < list.length; i++) {
        const gap = list[i].x - (list[i - 1].x + NODE_W);
        assert.ok(gap > MIN_GAP - 1, `${key}: ${list[i - 1].id} and ${list[i].id} overlap (gap ${gap})`);
      }
    }
  });

  test(`[${mode}] the canvas is large enough to hold every card`, () => {
    const layout = computeLayout(entries, tracks, mode);
    for (const entry of entries) {
      const spot = layout.placed.get(entry.id);
      assert.ok(spot.x >= 0, `${entry.id} sits off the left edge`);
      assert.ok(spot.x + NODE_W <= layout.width, `${entry.id} overflows the width`);
      assert.ok(spot.y + NODE_H <= layout.height, `${entry.id} overflows the height`);
    }
  });

  test(`[${mode}] columns are sorted and unique`, () => {
    const layout = computeLayout(entries, tracks, mode);
    const keys = layout.columns.map((c) => c.key);
    assert.deepEqual(keys, [...new Set(keys)], 'duplicate columns');
    assert.deepEqual(keys, [...keys].sort((a, b) => a - b), 'columns out of order');
    for (const column of layout.columns) {
      assert.ok(column.label.length > 0 && column.sublabel.length > 0, `column ${column.key} has no label`);
    }
  });

  test(`[${mode}] bands cover every track without vertical collisions`, () => {
    const layout = computeLayout(entries, tracks, mode);
    assert.equal(layout.bands.length, tracks.length);
    for (let i = 1; i < layout.bands.length; i++) {
      const previous = layout.bands[i - 1];
      assert.ok(layout.bands[i].top >= previous.top + previous.height, 'bands overlap');
    }
  });
}

test('in-universe and release modes really do differ', () => {
  const story = computeLayout(entries, tracks, 'story');
  const release = computeLayout(entries, tracks, 'release');
  const moved = entries.filter((e) => story.placed.get(e.id).x !== release.placed.get(e.id).x);
  assert.ok(moved.length > entries.length / 3, 'switching modes barely moved anything');
});

test('edge paths are valid svg cubic curves', () => {
  const layout = computeLayout(entries, tracks, 'story');
  for (const link of universe.connections) {
    const path = edgePath(layout.placed.get(link.from), layout.placed.get(link.to));
    assert.match(path, /^M[-\d.]+,[-\d.]+ C[-\d.]+,[-\d.]+ [-\d.]+,[-\d.]+ [-\d.]+,[-\d.]+$/, path);
    assert.ok(!path.includes('NaN'), `NaN in path for ${link.from}->${link.to}`);
  }
});
