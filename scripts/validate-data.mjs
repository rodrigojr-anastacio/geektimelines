#!/usr/bin/env node
/** Fails the build if the dataset breaks its own rules. Run via `npm run check`. */
import fs from 'node:fs';

const universe = JSON.parse(fs.readFileSync('data/mcu.json', 'utf8'));
const posters = JSON.parse(fs.readFileSync('data/posters.json', 'utf8'));
const problems = [];

const ids = new Set();
const slugs = new Set();
const trackIds = new Set(universe.tracks.map((t) => t.id));

for (const entry of universe.entries) {
  if (ids.has(entry.id)) problems.push(`duplicate id: ${entry.id}`);
  if (slugs.has(entry.slug)) problems.push(`duplicate slug: ${entry.slug}`);
  ids.add(entry.id);
  slugs.add(entry.slug);
  if (!/^[a-z0-9-]+$/.test(entry.slug)) problems.push(`bad slug: ${entry.slug}`);
  if (!trackIds.has(entry.track)) problems.push(`${entry.id}: unknown track ${entry.track}`);
  if (entry.confidence === 'future' && entry.summary) {
    problems.push(`${entry.id}: marked unreleased but has a summary`);
  }
  if (entry.releaseDate && !/^\d{4}(-\d{2}(-\d{2})?)?$/.test(entry.releaseDate)) {
    problems.push(`${entry.id}: malformed releaseDate ${entry.releaseDate}`);
  }
  if (!posters.entries[entry.id]) problems.push(`${entry.id}: no TMDB match in posters.json`);
}

for (const link of universe.connections) {
  if (!ids.has(link.from)) problems.push(`connection from unknown id: ${link.from}`);
  if (!ids.has(link.to)) problems.push(`connection to unknown id: ${link.to}`);
  if (link.from === link.to) problems.push(`self-connection: ${link.from}`);
  if (!link.note?.trim()) problems.push(`connection ${link.from}->${link.to} has no note`);
}

if (problems.length) {
  console.error(`data validation failed (${problems.length}):`);
  for (const problem of problems) console.error(' -', problem);
  process.exit(1);
}
console.log(
  `data ok — ${universe.entries.length} entries, ${universe.connections.length} connections, ` +
    `${Object.keys(posters.entries).length} TMDB matches`,
);
