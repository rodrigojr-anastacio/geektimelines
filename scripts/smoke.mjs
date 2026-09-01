#!/usr/bin/env node
/**
 * End-to-end smoke checks against a running deployment.
 *   node scripts/smoke.mjs http://localhost:3000
 * Exits non-zero on the first hard failure so CI and the deploy flow can gate on it.
 */
import fs from 'node:fs';

const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const universe = JSON.parse(fs.readFileSync('data/mcu.json', 'utf8'));

let failures = 0;
let checks = 0;

const check = async (name, fn) => {
  checks++;
  try {
    await fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures++;
    console.error(`  FAIL ${name}\n       ${error.message}`);
  }
};

const get = async (path) => {
  const res = await fetch(`${base}${path}`, { redirect: 'follow' });
  const body = await res.text();
  return { res, body };
};

const expectOk = async (path, ...needles) => {
  const { res, body } = await get(path);
  if (res.status !== 200) throw new Error(`${path} returned ${res.status}`);
  for (const needle of needles) {
    if (!body.includes(needle)) throw new Error(`${path} is missing ${JSON.stringify(needle)}`);
  }
  return body;
};

console.log(`smoke testing ${base}`);

await check('home renders the map and the toolbar', () =>
  expectOk('/', 'In-universe', 'Release', 'Search a title'));

await check('home ships every entry as a card', async () => {
  const body = await expectOk('/');
  const missing = universe.entries.filter((e) => !body.includes(e.title.replace(/&/g, '&amp;')));
  if (missing.length) throw new Error(`${missing.length} titles absent from the HTML: ${missing.slice(0, 3).map((m) => m.id)}`);
});

await check('home is server-rendered with poster art', async () => {
  const body = await expectOk('/');
  const posters = body.match(/image\.tmdb\.org/g) ?? [];
  if (posters.length < 50) throw new Error(`only ${posters.length} poster URLs in the HTML`);
});

for (const path of ['/about', '/sources', '/privacy', '/contact']) {
  await check(`${path} renders`, () => expectOk(path));
}

await check('the contact page exposes a working mailto address', async () => {
  const body = await expectOk('/contact');
  const match = body.match(/mailto:([^"'<>]+)/);
  if (!match) throw new Error('no mailto link on /contact');
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(match[1])) throw new Error(`bad address: ${match[1]}`);
});

await check('every entry page is reachable and carries its own content', async () => {
  const sample = universe.entries;
  const results = [];
  for (let i = 0; i < sample.length; i += 12) {
    const slice = sample.slice(i, i + 12);
    results.push(
      ...(await Promise.all(
        slice.map(async (entry) => {
          const { res, body } = await get(`/mcu/${entry.slug}`);
          if (res.status !== 200) return `${entry.slug} -> ${res.status}`;
          if (!body.includes(entry.title.replace(/&/g, '&amp;'))) return `${entry.slug} missing its own title`;
          if (!body.includes('Story map')) return `${entry.slug} missing the back link`;
          return null;
        }),
      )),
    );
  }
  const bad = results.filter(Boolean);
  if (bad.length) throw new Error(bad.slice(0, 5).join('; '));
});

await check('entry pages carry a unique title tag', async () => {
  const picks = ['avengers-endgame', 'wandavision', 'eyes-of-wakanda'];
  const titles = new Set();
  for (const slug of picks) {
    const { body } = await get(`/mcu/${slug}`);
    const match = body.match(/<title>([^<]+)<\/title>/);
    if (!match) throw new Error(`${slug} has no <title>`);
    titles.add(match[1]);
  }
  if (titles.size !== picks.length) throw new Error('entry pages share a title tag');
});

await check('unreleased entries never render an invented summary', async () => {
  const unreleased = universe.entries.filter((e) => e.confidence === 'future');
  for (const entry of unreleased) {
    const { body } = await get(`/mcu/${entry.slug}`);
    const hasNotice = body.includes('does not invent a plot')
      || body.includes('not a summary of the finished work')
      || body.includes('not a plot summary');
    if (!hasNotice) {
      throw new Error(`${entry.slug} shows neither a caveat nor labelled context`);
    }
  }
});

await check('an unknown entry 404s instead of rendering an empty page', async () => {
  const { res } = await get('/mcu/this-does-not-exist');
  if (res.status !== 404) throw new Error(`expected 404, got ${res.status}`);
});

await check('robots.txt lets search engines in and points at the sitemap', async () => {
  const { body } = await get('/robots.txt');
  if (/Disallow:\s*\/\s*$/m.test(body)) throw new Error(`robots.txt still blocks everything:\n${body}`);
  if (!body.includes('Allow: /')) throw new Error(`robots.txt does not allow crawling:\n${body}`);
  if (!body.includes('sitemap.xml')) throw new Error('robots.txt does not reference the sitemap');
});

await check('no page carries a noindex directive', async () => {
  for (const path of ['/', '/about', '/sources', '/mcu/avengers-endgame']) {
    const body = await expectOk(path);
    if (/noindex/i.test(body)) throw new Error(`${path} is still marked noindex`);
  }
});

await check('the home page links to every entry so crawlers can reach them', async () => {
  const body = await expectOk('/');
  const missing = universe.entries.filter((e) => !body.includes(`href="/mcu/${e.slug}"`));
  if (missing.length) {
    throw new Error(`${missing.length} entries have no link from the home page: ${missing.slice(0, 3).map((m) => m.slug)}`);
  }
});

await check('structured data is present and parses', async () => {
  for (const path of ['/', '/mcu/avengers-endgame']) {
    const body = await expectOk(path);
    const blocks = [...body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
    if (!blocks.length) throw new Error(`${path} has no JSON-LD`);
    for (const [, json] of blocks) {
      const parsed = JSON.parse(json.replace(/&quot;/g, '"'));
      if (!parsed['@context'] || !parsed['@type']) throw new Error(`${path} has malformed JSON-LD`);
    }
  }
});

await check('the home page has a social share image', async () => {
  const body = await expectOk('/');
  if (!/og:image/.test(body)) throw new Error('no og:image on the home page');
  const match = body.match(/property="og:image"[^>]*content="([^"]+)"/);
  if (!match) return;
  // The tag is absolute against metadataBase, so resolve it against whichever
  // deployment is under test rather than always hitting the live domain.
  const path = match[1].replace(/^https?:\/\/[^/]+/, '');
  const res = await fetch(`${base}${path}`);
  if (!res.ok) throw new Error(`og:image returned ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`og:image is ${type}, not an image`);
});

await check('the site ships a favicon that actually resolves', async () => {
  const body = await expectOk('/');
  const match = body.match(/<link rel="icon"[^>]*href="([^"]+)"/);
  if (!match) throw new Error('no icon link in the head');
  const res = await fetch(`${base}${match[1].replace(/^https?:\/\/[^/]+/, '')}`);
  if (!res.ok) throw new Error(`icon returned ${res.status}`);
  if (!(res.headers.get('content-type') ?? '').startsWith('image/')) {
    throw new Error('icon is not an image');
  }
});

await check('the tab title leads with the brand on the home page', async () => {
  const body = await expectOk('/');
  const title = body.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
  if (!title.startsWith('GeekTimelines')) {
    throw new Error(`home title does not lead with the brand: ${title}`);
  }
  const entry = await expectOk('/mcu/avengers-endgame');
  const entryTitle = entry.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
  if (!entryTitle.startsWith('Avengers: Endgame')) {
    throw new Error(`entry title should lead with the title: ${entryTitle}`);
  }
});

await check('pages declare a canonical url', async () => {
  const body = await expectOk('/mcu/avengers-endgame');
  if (!body.includes('rel="canonical"')) throw new Error('entry page has no canonical link');
});

await check('sitemap lists the entry pages', async () => {
  const { res, body } = await get('/sitemap.xml');
  if (res.status !== 200) throw new Error(`sitemap returned ${res.status}`);
  const urls = (body.match(/<loc>/g) ?? []).length;
  if (urls < universe.entries.length) throw new Error(`sitemap only has ${urls} urls`);
});

await check('security headers are set', async () => {
  const { res } = await get('/');
  const expected = { 'x-content-type-options': 'nosniff', 'x-frame-options': 'SAMEORIGIN' };
  for (const [header, value] of Object.entries(expected)) {
    if (res.headers.get(header) !== value) {
      throw new Error(`${header} is ${res.headers.get(header)}, expected ${value}`);
    }
  }
});

await check('credits live on the about page and nowhere else', async () => {
  const about = await expectOk('/about');
  if (!about.includes('not endorsed or certified by TMDB')) {
    throw new Error('/about is missing the attribution');
  }
  for (const path of ['/', '/sources', '/contact', '/privacy', '/mcu/avengers-endgame']) {
    const body = await expectOk(path);
    if (body.includes('not endorsed or certified by TMDB')) {
      throw new Error(`${path} repeats the credits boilerplate`);
    }
  }
});

await check('titles with no summary show context instead of a blank space', async () => {
  const withContext = universe.entries.filter((e) => e.context);
  if (!withContext.length) throw new Error('no entries carry context');
  for (const entry of withContext) {
    const { body } = await get(`/mcu/${entry.slug}`);
    if (!body.includes('not a summary of the finished work') && !body.includes('not a plot summary')) {
      throw new Error(`${entry.slug} does not label its context as unofficial`);
    }
  }
});

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
