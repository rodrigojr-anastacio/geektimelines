import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: `Report a correction or get in touch with ${SITE.name}.`,
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <main className="page">
      <h1>Contact</h1>
      <p className="lede">
        Corrections are the most useful thing you can send. Point at the source and it gets fixed.
      </p>

      <h2>Report a correction</h2>
      <p>
        If a date, a placement or a connection on the map is wrong, write in with the title, what is
        wrong, and where the correct information comes from. Corrections that cite a source are applied
        quickly; ones that cannot be verified are held rather than guessed at, which is the same rule
        the rest of the site follows.
      </p>

      <h2>Email</h2>
      <p>
        <a href="mailto:hello@geektimelines.com">hello@geektimelines.com</a>
      </p>

      <h2>Rights holders</h2>
      <p>
        {SITE.name} is an unofficial fan project and is not affiliated with Marvel, The Walt Disney
        Company or any other rights holder. Artwork is served from TMDB. {SITE.tmdbAttribution} If you
        represent a rights holder and want something removed, write to the address above and it will be
        handled.
      </p>

      <h2>Method</h2>
      <p>
        Before writing in about a placement that looks odd, the{' '}
        <Link href="/sources">sources page</Link> may already explain it — several placements are
        disputed and are flagged on purpose.
      </p>
    </main>
  );
}
