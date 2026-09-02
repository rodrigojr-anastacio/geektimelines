import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const universe = JSON.parse(fs.readFileSync('data/mcu.json', 'utf8'));
const posters = JSON.parse(fs.readFileSync('data/posters.json', 'utf8'));
const ids = new Set(universe.entries.map((e) => e.id));

test('every entry has a unique id and slug', () => {
  const seenIds = new Set();
  const seenSlugs = new Set();
  for (const entry of universe.entries) {
    assert.ok(!seenIds.has(entry.id), `duplicate id ${entry.id}`);
    assert.ok(!seenSlugs.has(entry.slug), `duplicate slug ${entry.slug}`);
    seenIds.add(entry.id);
    seenSlugs.add(entry.slug);
  }
});

test('slugs are url safe', () => {
  for (const entry of universe.entries) {
    assert.match(entry.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `bad slug on ${entry.id}: ${entry.slug}`);
  }
});

test('every connection points at entries that exist and is not a self-loop', () => {
  for (const link of universe.connections) {
    assert.ok(ids.has(link.from), `unknown source ${link.from}`);
    assert.ok(ids.has(link.to), `unknown target ${link.to}`);
    assert.notEqual(link.from, link.to, `self connection on ${link.from}`);
    assert.ok(link.note.trim().length > 0, `connection ${link.from}->${link.to} has no note`);
  }
});

test('every entry points at a declared track', () => {
  const trackIds = new Set(universe.tracks.map((t) => t.id));
  for (const entry of universe.entries) {
    assert.ok(trackIds.has(entry.track), `${entry.id} has unknown track ${entry.track}`);
  }
});

test('unreleased titles never carry an invented summary', () => {
  for (const entry of universe.entries) {
    if (entry.confidence === 'future') {
      assert.equal(entry.summary, null, `${entry.id} is unreleased but has a summary`);
    }
  }
});

test('release dates are well formed or explicitly null', () => {
  for (const entry of universe.entries) {
    if (entry.releaseDate === null) continue;
    assert.match(entry.releaseDate, /^\d{4}(-\d{2}(-\d{2})?)?$/, `${entry.id}: ${entry.releaseDate}`);
  }
});

test('phases are within the six known phases, or explicitly absent', () => {
  for (const entry of universe.entries) {
    if (entry.phase === null) continue;
    assert.ok(entry.phase >= 1 && entry.phase <= 6, `${entry.id} has phase ${entry.phase}`);
  }
});

test('every entry resolved to a TMDB record', () => {
  for (const entry of universe.entries) {
    assert.ok(posters.entries[entry.id], `${entry.id} has no TMDB match`);
  }
});

test('poster paths, when present, look like TMDB paths', () => {
  for (const [id, match] of Object.entries(posters.entries)) {
    if (match.posterPath === null) continue;
    assert.match(match.posterPath, /^\/[\w.-]+\.(jpg|png|svg)$/, `${id}: ${match.posterPath}`);
  }
});

test('the graph is connected enough to be worth drawing', () => {
  const linked = new Set(universe.connections.flatMap((c) => [c.from, c.to]));
  const orphans = universe.entries.filter((e) => !linked.has(e.id));
  // Some entries legitimately stand alone, but most should be wired in.
  assert.ok(orphans.length < universe.entries.length * 0.25, `too many orphans: ${orphans.map((o) => o.id)}`);
});

// ---- regressions reported by readers ------------------------------------

test('The Consultant is an epilogue to The Incredible Hulk, not a setup for it', () => {
  const edges = universe.connections.filter((c) => c.from === 'cons' || c.to === 'cons');
  assert.ok(edges.length > 0, 'The Consultant lost its connection');
  const edge = edges.find((c) => c.from === 'hulk' || c.to === 'hulk');
  assert.ok(edge, 'The Consultant is no longer linked to The Incredible Hulk');
  assert.equal(edge.from, 'hulk', 'the arrow points backwards: the short happens after the film');
  assert.equal(edge.to, 'cons');
});

test('Loki shows its causal anchor as well as sitting outside time', () => {
  for (const id of ['loki1', 'loki2']) {
    const entry = universe.entries.find((e) => e.id === id);
    assert.match(entry.inUniverseLabel, /outside of time/i, `${id} lost the out-of-time note`);
    assert.match(entry.inUniverseLabel, /2023/, `${id} hides the year it is anchored to`);
    assert.equal(entry.inUniverseStart, 2023, `${id} is not anchored after Endgame`);
  }
});

test('Loki lands after Endgame on the in-universe axis', () => {
  const endgame = universe.entries.find((e) => e.id === 'endgame');
  const loki = universe.entries.find((e) => e.id === 'loki1');
  assert.ok(loki.inUniverseStart >= endgame.inUniverseEnd, 'Loki no longer follows the Time Heist');
});

test('the animated shorts and specials Marvel counts are present', () => {
  for (const slug of ['i-am-groot', 'the-punisher-one-last-kill']) {
    assert.ok(
      universe.entries.some((e) => e.slug === slug),
      `${slug} is missing from the timeline`,
    );
  }
});

test('every title on Marvel’s official Complete Timeline is present', () => {
  // Transcribed from the MCU Complete Timeline Marvel publishes on the Disney+
  // brand page. Anything on that list belongs on this map.
  const official = [
    'eow', 'cap1', 'osac', 'cm', 'im', 'im2', 'hulk', 'hammer', 'thor', 'cons',
    'avengers', 'item47', 'tdw', 'im3', 'allhail', 'ws', 'gotg', 'gotg2', 'groot',
    'dd1', 'jj1', 'aou', 'antman', 'dd2', 'lc1', 'if1', 'def', 'cw', 'bw', 'bp',
    'hc', 'pun1', 'ds', 'jj2', 'lc2', 'if2', 'dd3', 'rag', 'pun2', 'jj3', 'amw',
    'iw', 'endgame', 'loki1', 'whatif', 'zomb', 'wv', 'shang', 'tfatws', 'ffh',
    'eternals', 'nwh', 'mom', 'hawkeye', 'mk', 'wf', 'echo', 'shulk', 'msm', 'lt',
    'ironheart', 'wbn', 'ghs', 'quant', 'gotg3', 'si', 'marvels', 'loki2', 'dpw',
    'agatha', 'ddba', 'bnw', 'thunder', 'ff4', 'wman', 'ddba2', 'punisher',
  ];
  const ids = new Set(universe.entries.map((e) => e.id));
  const missing = official.filter((id) => !ids.has(id));
  assert.deepEqual(missing, [], `missing from the official list: ${missing.join(', ')}`);
});

test('the Marvel Television run is here, since Marvel puts it on the timeline', () => {
  const netflix = ['dd1', 'dd2', 'dd3', 'jj1', 'jj2', 'jj3', 'lc1', 'lc2', 'if1', 'if2', 'def', 'pun1', 'pun2'];
  for (const id of netflix) {
    const entry = universe.entries.find((e) => e.id === id);
    assert.ok(entry, `${id} is missing`);
    assert.equal(entry.phase, null, `${id} was given an invented phase`);
    assert.equal(entry.confidence, 'approx', `${id} claims more certainty than the source supports`);
  }
});

test('a phase is either one of the six or explicitly absent', () => {
  for (const entry of universe.entries) {
    if (entry.phase === null) continue;
    assert.ok(
      Number.isInteger(entry.phase) && entry.phase >= 1 && entry.phase <= 6,
      `${entry.id} has phase ${entry.phase}`,
    );
  }
});
