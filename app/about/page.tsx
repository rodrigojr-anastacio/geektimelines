import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';
import { entries, connections } from '@/lib/data';

export const metadata: Metadata = {
  title: 'About',
  description: `What ${SITE.name} is, who makes it, and the rules it follows.`,
  alternates: { canonical: '/about' },
};

export default function AboutPage() {
  return (
    <main className="page">
      <h1>About</h1>
      <p className="lede">
        {SITE.name} draws story maps for fictional universes — the whole thing on one canvas, with the
        connections between the pieces drawn as lines you can follow.
      </p>

      <h2>Why a map and not a list</h2>
      <p>
        Chronology lists tell you what comes next. They do not tell you <em>why</em>. The interesting
        part of a shared universe is the wiring: a post-credits scene that sets up a film four years
        away, a character who walks out of one series into another, a branch where a timeline splits.
        A list flattens all of that into one column. A map keeps it visible.
      </p>
      <p>
        The Marvel Cinematic Universe map currently holds {entries.length} entries and{' '}
        {connections.length} mapped connections. DC, Star Wars and Middle-earth are next.
      </p>

      <h2>The rules</h2>
      <p>
        Nothing on these pages is invented. Every in-universe year is either stated on screen, printed
        in an official source, or explicitly marked as an estimate. Titles that have been announced but
        have no released material carry no plot summary at all — an empty space is more useful than a
        confident guess. Connections that are announced or inferred rather than shown are drawn in a
        different weight so you can tell them apart at a glance.
      </p>
      <p>
        The full method, and the list of sources behind it, is on the{' '}
        <Link href="/sources">sources page</Link>.
      </p>

      <h2>Corrections</h2>
      <p>
        If something here is wrong, it should be fixed rather than defended. Send it over through the{' '}
        <Link href="/contact">contact page</Link> and point at the source — corrections with a citation
        get applied quickly.
      </p>

      <h2>Credits</h2>
      <p>
        Film and series metadata and artwork come from{' '}
        <a href="https://www.themoviedb.org/" rel="noreferrer noopener" target="_blank">TMDB</a>.{' '}
        {SITE.tmdbAttribution}
      </p>
      <p>
        This is an unofficial fan project. Marvel, the MCU and all related titles are trademarks of
        Marvel / The Walt Disney Company, and this site is not affiliated with, endorsed by, or
        connected to them in any way.
      </p>
    </main>
  );
}
