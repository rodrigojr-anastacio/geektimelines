import type { Entry } from './schema';
import { SITE } from './site';
import { posterUrl, linksFor, TYPE_LABEL } from './data';

const isSeries = (entry: Entry) => entry.type === 'series' || entry.type === 'anim';

/** Schema.org description for a single entry, falling back to labelled context. */
function describe(entry: Entry): string {
  if (entry.summary) return entry.summary;
  if (entry.context) return entry.context;
  return `${entry.title} on the ${SITE.name} Marvel Cinematic Universe story map.`;
}

export function entryJsonLd(entry: Entry) {
  const image = posterUrl(entry.id, 'w500');
  const related = linksFor(entry.id).slice(0, 8).map((link) => ({
    '@type': isSeries(link.other) ? 'TVSeries' : 'Movie',
    name: link.other.title,
    url: `${SITE.url}/mcu/${link.other.slug}`,
  }));

  return {
    '@context': 'https://schema.org',
    '@type': isSeries(entry) ? 'TVSeries' : 'Movie',
    name: entry.title,
    url: `${SITE.url}/mcu/${entry.slug}`,
    description: describe(entry).slice(0, 500),
    ...(image ? { image } : {}),
    ...(entry.releaseDate && entry.releaseDate.length === 10
      ? { datePublished: entry.releaseDate }
      : {}),
    genre: ['Action', 'Adventure', 'Science Fiction'],
    partOfSeries: { '@type': 'CreativeWorkSeries', name: 'Marvel Cinematic Universe' },
    ...(related.length ? { isRelatedTo: related } : {}),
  };
}

export function breadcrumbJsonLd(entry: Entry) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Story map', item: SITE.url },
      { '@type': 'ListItem', position: 2, name: 'Marvel Cinematic Universe', item: `${SITE.url}/` },
      { '@type': 'ListItem', position: 3, name: entry.title, item: `${SITE.url}/mcu/${entry.slug}` },
    ],
  };
}

export function siteJsonLd(entries: Entry[]) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE.name,
      url: SITE.url,
      description: SITE.description,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Marvel Cinematic Universe — every film, series, one-shot and special',
      numberOfItems: entries.length,
      itemListElement: entries.map((entry, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: `${entry.title} (${TYPE_LABEL[entry.type]})`,
        url: `${SITE.url}/mcu/${entry.slug}`,
      })),
    },
  ];
}

/** Renders one or more JSON-LD blocks. */
export function JsonLd({ data }: { data: object | object[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
