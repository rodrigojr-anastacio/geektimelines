import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { computeLayout, NODE_W, MIN_GAP } from '../lib/layout.ts';

const universe = JSON.parse(fs.readFileSync('data/mcu.json', 'utf8'));
const { entries, tracks } = universe;
const allEvents = entries.flatMap((e) => e.events.map((v) => ({ ...v, entry: e })));

const KINDS = new Set(['main', 'flashback', 'timeTravel', 'epilogue']);
/** Only sources the project has actually checked are allowed to appear. */
const ALLOWED_SOURCES = new Set([
  'Shown on screen',
  'Popverse MCU timeline',
  'Marvel official timeline (2023)',
  // Used where the official book cannot reach: it was published in October 2023.
  'Wikipedia MCU timeline',
]);

test('every entry declares a span', () => {
  for (const entry of entries) {
    assert.equal(typeof entry.inUniverseStart, 'number', `${entry.id} has no start`);
    assert.equal(typeof entry.inUniverseEnd, 'number', `${entry.id} has no end`);
    assert.ok(entry.inUniverseEnd >= entry.inUniverseStart, `${entry.id} ends before it starts`);
  }
});

test('the anchor year matches the start of the span', () => {
  for (const entry of entries) {
    assert.equal(entry.inUniverseYear, entry.inUniverseStart, `${entry.id} is anchored off its span`);
  }
});

test('a span never contradicts its own label', () => {
  for (const entry of entries) {
    if (entry.inUniverseEnd === entry.inUniverseStart) continue;
    const years = (entry.inUniverseLabel.match(/\d{4}/g) ?? []).map(Number);
    if (!years.length) continue;
    assert.ok(
      years.includes(entry.inUniverseStart),
      `${entry.id}: label "${entry.inUniverseLabel}" does not mention start ${entry.inUniverseStart}`,
    );
    assert.ok(
      years.includes(entry.inUniverseEnd),
      `${entry.id}: label "${entry.inUniverseLabel}" does not mention end ${entry.inUniverseEnd}`,
    );
  }
});

test('every event carries a source, and only checked ones', () => {
  assert.ok(allEvents.length > 0, 'no events at all');
  for (const event of allEvents) {
    assert.ok(event.source?.trim(), `${event.entry.id}: "${event.what}" has no source`);
    assert.ok(
      ALLOWED_SOURCES.has(event.source),
      `${event.entry.id}: unvetted source "${event.source}"`,
    );
  }
});

test('every event is complete and well formed', () => {
  for (const event of allEvents) {
    assert.equal(typeof event.year, 'number', `${event.entry.id}: event year is not a number`);
    assert.ok(Number.isInteger(event.year), `${event.entry.id}: non-integer year`);
    assert.ok(event.label?.trim(), `${event.entry.id}: event has no label`);
    assert.ok(event.what?.trim(), `${event.entry.id}: event has no description`);
    assert.ok(KINDS.has(event.kind), `${event.entry.id}: unknown kind ${event.kind}`);
  }
});

test('an event label agrees with its sort year', () => {
  for (const event of allEvents) {
    if (/BC/i.test(event.label)) {
      assert.ok(event.year < 0, `${event.entry.id}: "${event.label}" is BC but sorts as ${event.year}`);
      const stated = Number(event.label.match(/\d+/)[0]);
      assert.equal(Math.abs(event.year), stated, `${event.entry.id}: BC year mismatch`);
      continue;
    }
    // A vague label like "Mid-2000s" or "Late 1990s" only pins a decade, so it is
    // checked against the decade rather than the exact year.
    const vague = /\d{4}s\b/.test(event.label);
    const stated = event.label.match(/\d{4}/);
    if (!stated) continue;
    const year = Number(stated[0]);
    if (vague) {
      assert.ok(
        event.year >= year && event.year <= year + 9,
        `${event.entry.id}: "${event.label}" but sorts as ${event.year}`,
      );
    } else {
      assert.equal(year, event.year, `${event.entry.id}: "${event.label}" vs ${event.year}`);
    }
  }
});

test('events inside the span are main or epilogue, outside are flashback or time travel', () => {
  for (const entry of entries) {
    for (const event of entry.events) {
      const inside = event.year >= entry.inUniverseStart && event.year <= entry.inUniverseEnd;
      if (!inside && event.kind === 'main') {
        assert.fail(`${entry.id}: "${event.label}" is outside the span but marked main`);
      }
      if (inside && event.kind === 'flashback') {
        assert.fail(`${entry.id}: "${event.label}" sits inside the span but is marked a flashback`);
      }
    }
  }
});

test('time travel only appears where the story actually travels', () => {
  const travellers = entries.filter((e) => e.events.some((v) => v.kind === 'timeTravel'));
  const ids = travellers.map((e) => e.id).sort();
  assert.deepEqual(ids, ['endgame', 'loki1'], `unexpected time travellers: ${ids}`);
});

test('Endgame reaches every heist destination', () => {
  const endgame = entries.find((e) => e.id === 'endgame');
  const years = endgame.events.filter((e) => e.kind === 'timeTravel').map((e) => e.year).sort();
  assert.deepEqual(years, [1970, 2012, 2013, 2014], `heist years are ${years}`);
});

test('the span is data only: it never widens an entry on the map', () => {
  // Spans are kept in the dataset (they anchor and order entries, and the card
  // label shows the range) but are deliberately not drawn, so the map stays
  // clean and the chronology lives inside the entry instead.
  const layout = computeLayout(entries, tracks, 'story');
  for (const [, spot] of layout.placed) {
    assert.equal(Object.hasOwn(spot, 'spanEnd'), false, 'a span bar leaked back into the layout');
  }
  const spanning = entries.filter((e) => e.inUniverseEnd > e.inUniverseStart);
  assert.ok(spanning.length > 0, 'spans vanished from the data');
  const columns = layout.columns.map((c) => c.key);
  for (const entry of spanning) {
    assert.ok(columns.includes(entry.inUniverseStart), `${entry.id} has no column for its start`);
  }
});
