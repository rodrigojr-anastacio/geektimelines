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

test('phases are within the six known phases', () => {
  for (const entry of universe.entries) {
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
