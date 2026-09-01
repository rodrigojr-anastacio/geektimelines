import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  bySlug, byId, entries, linksFor, posterUrl, formatRelease,
  TYPE_LABEL, KIND_LABEL, CONFIDENCE_NOTE, CONTEXT_LABEL, tracks,
} from '@/lib/data';
import { SITE } from '@/lib/site';
import { JsonLd, entryJsonLd, breadcrumbJsonLd } from '@/lib/structured-data';
import styles from './entry.module.css';

export function generateStaticParams() {
  return entries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const entry = bySlug.get(slug);
  if (!entry) return {};
  const description =
    entry.summary ??
    `${entry.title} on the ${SITE.name} Marvel Cinematic Universe story map: in-universe placement, release date and every mapped connection.`;
  const poster = posterUrl(entry.id, 'w500');
  return {
    title: entry.title,
    description: description.slice(0, 300),
    alternates: { canonical: `/mcu/${entry.slug}` },
    openGraph: {
      title: `${entry.title} · ${SITE.name}`,
      description: description.slice(0, 300),
      type: 'article',
      images: poster ? [{ url: poster }] : undefined,
    },
  };
}

export default async function EntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = bySlug.get(slug);
  if (!entry) notFound();

  const links = linksFor(entry.id);
  const outbound = links.filter((l) => l.direction === 'out');
  const inbound = links.filter((l) => l.direction === 'in');
  const poster = posterUrl(entry.id, 'w342');
  const caveat = CONFIDENCE_NOTE[entry.confidence];
  const track = tracks.find((t) => t.id === entry.track);

  return (
    <main className={styles.wrap}>
      <JsonLd data={[entryJsonLd(entry), breadcrumbJsonLd(entry)]} />
      {/* AdSense slot — top leaderboard, reserved space only */}
      <div className="ad-slot ad-leaderboard" data-ad-slot="leaderboard" />

      <article className={styles.article}>
        <Link href="/" className={styles.back}>← Story map</Link>

        <div className={styles.head}>
          {poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.poster} src={poster} alt={`${entry.title} poster`} width={200} height={300} />
          )}
          <div>
            <span className="mono">Phase {entry.phase} · {TYPE_LABEL[entry.type]}</span>
            <h1 className={styles.title}>{entry.title}</h1>
            <dl className={styles.facts}>
              <div><dt>In-universe</dt><dd>{entry.inUniverseLabel}</dd></div>
              <div><dt>Released</dt><dd>{formatRelease(entry.releaseDate)}</dd></div>
              <div><dt>Thread</dt><dd>{track?.name ?? entry.track}</dd></div>
            </dl>
          </div>
        </div>

        {entry.summary ? (
          <p className={styles.summary}>{entry.summary}</p>
        ) : entry.context && entry.contextSource ? (
          <div className={styles.context}>
            <span className={styles.contextLabel}>{CONTEXT_LABEL[entry.contextSource]}</span>
            <p className={styles.summary}>{entry.context}</p>
          </div>
        ) : (
          <p className={styles.summary} style={{ color: 'var(--ink-45)' }}>
            No verified summary is available for this title yet. Nothing was written here so this page
            does not invent a plot.
          </p>
        )}

        {caveat && (
          <p className={styles.caveat}>
            <b>{caveat.mark} {caveat.label}.</b> {caveat.note}
          </p>
        )}

        {outbound.length > 0 && (
          <section>
            <h2 className={styles.section}>Leads to</h2>
            <ul className={styles.links}>
              {outbound.map((link) => (
                <li key={`out-${link.to}`}>
                  <Link href={`/mcu/${link.other.slug}`}>
                    <span className="mono">{KIND_LABEL[link.kind]}</span>
                    <strong>{link.other.title}</strong>
                    <span className={styles.note}>{link.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {inbound.length > 0 && (
          <section>
            <h2 className={styles.section}>Comes from</h2>
            <ul className={styles.links}>
              {inbound.map((link) => (
                <li key={`in-${link.from}`}>
                  <Link href={`/mcu/${link.other.slug}`}>
                    <span className="mono">{KIND_LABEL[link.kind]}</span>
                    <strong>{link.other.title}</strong>
                    <span className={styles.note}>{link.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* AdSense slot — in-article, reserved space only */}
        <div className="ad-slot ad-inline" data-ad-slot="entry-inline" />

        <p className={styles.method}>
          Placement and dates follow the sources listed in the{' '}
          <Link href="/sources">method page</Link>.
        </p>
      </article>
    </main>
  );
}
