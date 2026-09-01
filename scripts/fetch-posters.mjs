#!/usr/bin/env node
/**
 * Resolves every entry in data/<universe>.json against the TMDB API and writes
 * data/posters.json (committed) plus, optionally, cached images in public/posters
 * (gitignored — production serves the TMDB CDN through next/image).
 *
 * TMDB allows roughly 40 requests/second (developer.themoviedb.org/docs/rate-limiting).
 * We stay far below that: 4 in flight, 120ms spacing, exponential backoff on 429/5xx.
 */
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.TMDB_API_KEY;
const UNIVERSE = process.argv[2] ?? 'mcu';
const DOWNLOAD = process.argv.includes('--download');
const ROOT = process.cwd();
const DATA = path.join(ROOT, 'data', `${UNIVERSE}.json`);
const OUT = path.join(ROOT, 'data', 'posters.json');
const IMG_DIR = path.join(ROOT, 'public', 'posters');

const CONCURRENCY = 4;
const SPACING_MS = 120;
const MAX_RETRIES = 4;

/** Titles TMDB indexes differently from our display name. */
const QUERY_OVERRIDES = {
  osac: { q: 'Marvel One-Shot: Agent Carter', type: 'movie' },
  cons: { q: 'Marvel One-Shot: The Consultant', type: 'movie' },
  hammer: { q: "Marvel One-Shot: A Funny Thing Happened on the Way to Thor's Hammer", type: 'movie' },
  item47: { q: 'Marvel One-Shot: Item 47', type: 'movie' },
  allhail: { q: 'Marvel One-Shot: All Hail the King', type: 'movie' },
  ac: { q: 'Marvel’s Agent Carter', type: 'tv' },
  ghs: { q: 'The Guardians of the Galaxy Holiday Special', type: 'movie' },
  wbn: { q: 'Werewolf by Night', type: 'movie' },
  eow: { q: 'Eyes of Wakanda', type: 'tv' },
  zomb: { q: 'Marvel Zombies', type: 'tv' },
  whatif: { q: 'What If...?', type: 'tv' },
  loki1: { q: 'Loki', type: 'tv' },
  loki2: { q: 'Loki', type: 'tv' },
  ddba: { q: 'Daredevil: Born Again', type: 'tv' },
  ddba2: { q: 'Daredevil: Born Again', type: 'tv' },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function tmdb(pathname, params) {
  const url = new URL(`https://api.themoviedb.org/3${pathname}`);
  url.searchParams.set('api_key', KEY);
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (res.ok) return res.json();
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? 1) * 1000 + 250;
      await sleep(wait);
      continue;
    }
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(2 ** attempt * 500);
      continue;
    }
    throw new Error(`TMDB ${res.status} on ${pathname}`);
  }
  throw new Error(`TMDB gave up after ${MAX_RETRIES} retries on ${pathname}`);
}

/** Strips our display decorations so the query matches TMDB's own title. */
function cleanTitle(title) {
  return title
    .replace(/\s*\((?:S\d+(?:[–-]S?\d+)?)\)\s*$/i, '')
    .replace(/\s*\(S\d+[–-]S\d+\)\s*$/i, '')
    .replace(/…/g, '...')
    .trim();
}

function pick(results, wantedYear) {
  if (!results?.length) return null;
  if (!wantedYear) return results[0];
  const dated = results.filter((r) => r.release_date || r.first_air_date);
  const exact = dated.find((r) => (r.release_date ?? r.first_air_date).slice(0, 4) === String(wantedYear));
  return exact ?? results[0];
}

async function resolve(entry) {
  const override = QUERY_OVERRIDES[entry.id];
  const type = override?.type ?? (entry.type === 'series' || entry.type === 'anim' ? 'tv' : 'movie');
  const query = override?.q ?? cleanTitle(entry.title);
  const year = entry.releaseDate ? entry.releaseDate.slice(0, 4) : undefined;

  let data = await tmdb(`/search/${type}`, {
    query,
    [type === 'movie' ? 'primary_release_year' : 'first_air_date_year']: year,
  });
  let hit = pick(data.results, year);
  if (!hit) {
    data = await tmdb(`/search/${type}`, { query });
    hit = pick(data.results, year);
  }
  if (!hit) {
    // Last resort: the other media type (some specials are indexed as the opposite kind).
    const alt = type === 'movie' ? 'tv' : 'movie';
    data = await tmdb(`/search/${alt}`, { query });
    hit = pick(data.results, year);
    if (hit) return shape(entry, alt, hit);
  }
  return hit ? shape(entry, type, hit) : { id: entry.id, resolved: false, query, type };
}

function shape(entry, type, hit) {
  return {
    id: entry.id,
    resolved: true,
    tmdbType: type,
    tmdbId: hit.id,
    tmdbTitle: hit.title ?? hit.name,
    tmdbDate: hit.release_date ?? hit.first_air_date ?? null,
    posterPath: hit.poster_path ?? null,
    backdropPath: hit.backdrop_path ?? null,
  };
}

async function pool(items, worker) {
  const out = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await sleep(SPACING_MS);
        try {
          out[index] = await worker(items[index]);
        } catch (error) {
          out[index] = { id: items[index].id, resolved: false, error: String(error.message ?? error) };
        }
      }
    }),
  );
  return out;
}

async function download(entries) {
  fs.mkdirSync(IMG_DIR, { recursive: true });
  for (const entry of entries) {
    if (!entry.posterPath) continue;
    const dest = path.join(IMG_DIR, `${entry.id}.jpg`);
    if (fs.existsSync(dest)) continue;
    const res = await fetch(`https://image.tmdb.org/t/p/w342${entry.posterPath}`);
    if (!res.ok) continue;
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    await sleep(SPACING_MS);
  }
}

const universe = JSON.parse(fs.readFileSync(DATA, 'utf8'));

if (!KEY) {
  console.warn('TMDB_API_KEY not set — keeping the existing data/posters.json untouched.');
  if (!fs.existsSync(OUT)) fs.writeFileSync(OUT, JSON.stringify({ entries: {} }, null, 2) + '\n');
  process.exit(0);
}

const resolved = await pool(universe.entries, resolve);
const map = Object.fromEntries(resolved.filter((r) => r.resolved).map((r) => [r.id, r]));
fs.writeFileSync(OUT, JSON.stringify({ source: 'TMDB', entries: map }, null, 2) + '\n');

const missing = resolved.filter((r) => !r.resolved);
console.log(`resolved ${Object.keys(map).length}/${universe.entries.length}`);
if (missing.length) console.log('unresolved:', missing.map((m) => m.id).join(', '));

if (DOWNLOAD) {
  await download(Object.values(map));
  console.log('cached posters in public/posters');
}
