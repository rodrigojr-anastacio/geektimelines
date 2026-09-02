import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

/**
 * Marvel's MCU Complete Timeline, read from marvel.com on 2026-09-01 (article
 * dated 2026-06-02). It gives order and no dates, which makes it the one thing
 * our in-universe years can actually be checked against: if the years we show
 * do not reproduce this sequence, they are wrong by our own declared standard.
 */
const OFFICIAL_ORDER = [
  'eow', 'cap1', 'osac', 'cm', 'im', 'im2', 'hulk', 'hammer', 'thor', 'cons',
  'avengers', 'item47', 'tdw', 'im3', 'allhail', 'ws', 'gotg', 'gotg2', 'groot',
  'dd1', 'jj1', 'aou', 'antman', 'dd2', 'lc1', 'if1', 'def', 'cw', 'bw', 'bp',
  'hc', 'pun1', 'ds', 'jj2', 'lc2', 'if2', 'dd3', 'rag', 'pun2', 'jj3', 'amw',
  'iw', 'endgame', 'loki1', 'whatif', 'zomb', 'wv', 'shang', 'tfatws', 'ffh',
  'eternals', 'nwh', 'mom', 'hawkeye', 'mk', 'wf', 'echo', 'shulk', 'msm', 'lt',
  'ironheart', 'wbn', 'ghs', 'quant', 'gotg3', 'si', 'marvels', 'loki2', 'dpw',
  'agatha', 'ddba', 'bnw', 'thunder', 'ff4', 'wman', 'ddba2', 'punisher',
];

const universe = JSON.parse(fs.readFileSync('data/mcu.json', 'utf8'));
const byId = new Map(universe.entries.map((e) => [e.id, e]));

test('every id in the official order exists in the dataset', () => {
  const missing = OFFICIAL_ORDER.filter((id) => !byId.has(id));
  assert.deepEqual(missing, [], `unknown ids: ${missing.join(', ')}`);
});

test('titles that sit off the year axis are marked as such', () => {
  // Marvel's list still orders these, but narratively: Deadpool & Wolverine is
  // placed late because it is mostly in other timelines, not because it happens
  // late. Checking their anchors against that sequence produced a real error.
  const expected = ['dpw', 'ff4', 'loki1', 'loki2', 'whatif', 'zomb'];
  const actual = universe.entries.filter((e) => e.offAxis).map((e) => e.id).sort();
  assert.deepEqual(actual, expected, 'the set of off-axis titles changed');
});

test('our in-universe years reproduce Marvel’s official ordering', () => {
  // Off-axis titles are exempt: see the test above.
  const rank = new Map(OFFICIAL_ORDER.map((id, i) => [id, i]));
  const onAxis = OFFICIAL_ORDER.filter((id) => !byId.get(id).offAxis);
  const sorted = [...onAxis].sort((a, b) => {
    const ya = byId.get(a).inUniverseStart;
    const yb = byId.get(b).inUniverseStart;
    return ya - yb || rank.get(a) - rank.get(b);
  });
  const inversions = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (rank.get(prev) > rank.get(cur)) {
      inversions.push(
        `${byId.get(prev).title} (${byId.get(prev).inUniverseStart}) sorts before ` +
          `${byId.get(cur).title} (${byId.get(cur).inUniverseStart}), Marvel has it the other way`,
      );
    }
  }
  assert.deepEqual(inversions, [], `\n  ${inversions.join('\n  ')}`);
});

test('no year claims to be confirmed when no source could confirm it', () => {
  // The Marvel timeline book was published in October 2023. Nothing that
  // premiered after it can have been dated by it, so nothing later may be
  // marked as a confirmed year.
  const BOOK_PUBLISHED = '2023-10-01';
  const overclaimed = universe.entries.filter(
    (e) => e.confidence === 'ok' && e.releaseDate && e.releaseDate > BOOK_PUBLISHED,
  );
  assert.deepEqual(
    overclaimed.map((e) => `${e.title} (released ${e.releaseDate})`),
    [],
    'these claim a confirmed in-universe year with no source that could confirm it',
  );
});
