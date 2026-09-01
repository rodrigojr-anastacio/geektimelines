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

await check('robots.txt keeps the site closed while noindex is on', async () => {
  const { body } = await get('/robots.txt');
  if (!body.includes('Disallow: /')) throw new Error(`robots.txt is not locked down:\n${body}`);
});

await check('pages carry the noindex directive', async () => {
  const body = await expectOk('/');
  if (!/noindex/.test(body)) throw new Error('no noindex meta on the home page');
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

await check('the TMDB attribution lives on the credits pages', async () => {
  for (const path of ['/about', '/sources']) {
    const body = await expectOk(path);
    if (!body.includes('not endorsed or certified by TMDB')) {
      throw new Error(`${path} is missing the TMDB attribution`);
    }
  }
});

await check('the footer does not carry the TMDB boilerplate', async () => {
  const body = await expectOk('/');
  const footer = body.slice(body.lastIndexOf('<footer'));
  if (footer.includes('not endorsed or certified by TMDB')) {
    throw new Error('TMDB boilerplate is still in the footer');
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
