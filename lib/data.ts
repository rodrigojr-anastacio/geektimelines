import mcuRaw from '@/data/mcu.json';
import postersRaw from '@/data/posters.json';
import { universeSchema, posterManifestSchema, type Entry, type Connection } from './schema';

/** Parsed once at module load: a malformed dataset fails the build, not a request. */
export const mcu = universeSchema.parse(mcuRaw);
export const posters = posterManifestSchema.parse(postersRaw);

export const entries = mcu.entries;
export const connections = mcu.connections;
export const tracks = mcu.tracks;

export const byId = new Map(entries.map((e) => [e.id, e]));
export const bySlug = new Map(entries.map((e) => [e.slug, e]));

export type Direction = 'out' | 'in';
export type Link = Connection & { direction: Direction; other: Entry };

const linkIndex = new Map<string, Link[]>();
for (const entry of entries) linkIndex.set(entry.id, []);
for (const link of connections) {
  const from = byId.get(link.from);
  const to = byId.get(link.to);
  if (!from || !to) continue;
  linkIndex.get(link.from)!.push({ ...link, direction: 'out', other: to });
  linkIndex.get(link.to)!.push({ ...link, direction: 'in', other: from });
}

export const linksFor = (id: string): Link[] => linkIndex.get(id) ?? [];

export const posterUrl = (id: string, size: 'w185' | 'w342' | 'w500' = 'w342'): string | null => {
  const hit = posters.entries[id];
  return hit?.posterPath ? `https://image.tmdb.org/t/p/${size}${hit.posterPath}` : null;
};

export const TYPE_LABEL: Record<Entry['type'], string> = {
  film: 'Film',
  series: 'Series',
  special: 'Special',
  oneshot: 'One-Shot',
  anim: 'Animation',
};

export const KIND_LABEL: Record<Connection['kind'], string> = {
  seq: 'Direct continuation',
  setup: 'Setup / post-credits',
  char: 'Shared character',
  branch: 'Multiverse branch',
  inf: 'Announced / inferred',
};

export const CONFIDENCE_NOTE: Record<string, { mark: string; label: string; note: string }> = {
  approx: {
    mark: '≈',
    label: 'Estimated year',
    note: 'The in-universe year is not officially confirmed. The placement follows the consensus of chronology guides and the internal references of the title itself.',
  },
  tv: {
    mark: '≈',
    label: 'Marvel Television',
    note: 'A Marvel Television production. It appears in chronology guides, but its canon status inside Marvel Studios’ official timeline is debated.',
  },
  future: {
    mark: '⧗',
    label: 'Not released yet',
    note: 'Announced title with no officially released plot material. Its position is provisional and no summary was written here, to avoid inventing content.',
  },
  pending: {
    mark: '⧗',
    label: 'Summary pending',
    note: 'Already released, but this map has no verified summary for it yet. Nothing was written rather than guessing at the plot.',
  },
  alt: {
    mark: '✦',
    label: 'Off the main axis',
    note: 'Not part of the main timeline axis. It is positioned here only for readability.',
  },
};

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2019-04-24" -> "Apr 2019"; "2026" -> "2026"; null -> "TBA". */
export const formatRelease = (value: string | null): string => {
  if (!value) return 'TBA';
  if (value.length === 4) return value;
  return `${MONTHS[Number(value.slice(5, 7))]} ${value.slice(0, 4)}`;
};

export const releaseYear = (value: string | null): number | null =>
  value ? Number(value.slice(0, 4)) : null;
