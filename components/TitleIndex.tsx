import Link from 'next/link';
import type { Entry } from '@/lib/schema';
import { formatRelease, TYPE_LABEL, phaseLabel } from '@/lib/data';
import styles from './TitleIndex.module.css';

/**
 * A plain, crawlable list of every entry. The map itself is a canvas of
 * buttons, so without this there is no link path from the home page into the
 * individual titles — for a reader who prefers a list, or for a crawler.
 */
export default function TitleIndex({ entries, heading = 'Every title on this map' }: {
  entries: Entry[];
  heading?: string;
}) {
  // Marvel Television titles have no phase, so they group under a key of their own.
  const byPhase = new Map<number, Entry[]>();
  for (const entry of [...entries].sort((a, b) => a.inUniverseYear - b.inUniverseYear)) {
    const key = entry.phase ?? 0;
    if (!byPhase.has(key)) byPhase.set(key, []);
    byPhase.get(key)!.push(entry);
  }
  const groups = [...byPhase.entries()].sort((a, b) => (a[0] || 99) - (b[0] || 99));

  return (
    <section className={styles.index}>
      <h2 className={styles.heading}>{heading}</h2>
      <p className={styles.intro}>
        The map is the quick way around. This is the same {entries.length} entries as a list, in
        in-universe order within each phase.
      </p>
      {groups.map(([phase, list]) => (
        <div key={phase} className={styles.group}>
          <h3 className={styles.phase}>{phaseLabel(phase || null)}</h3>
          <ul className={styles.list}>
            {list.map((entry) => (
              <li key={entry.id}>
                <Link href={`/mcu/${entry.slug}`}>
                  <span className={styles.title}>{entry.title}</span>
                  <span className={styles.meta}>
                    {TYPE_LABEL[entry.type]} · {entry.inUniverseLabel} · released {formatRelease(entry.releaseDate)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
