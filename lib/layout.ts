import type { Entry, Track } from './schema';

export const NODE_W = 250;
export const NODE_H = 92;
export const COL_W = 330;
export const ROW_H = 110;
export const PAD_X = 220;
export const PAD_TOP = 150;
export const BAND_GAP = 44;
export const MIN_GAP = 26;

export type Mode = 'story' | 'release';

export interface PlacedEntry {
  id: string;
  x: number;
  y: number;
  row: number;
}
export interface Band {
  id: string;
  name: string;
  top: number;
  height: number;
}
export interface Column {
  key: number;
  x: number;
  label: string;
  sublabel: string;
}
export interface Layout {
  placed: Map<string, PlacedEntry>;
  bands: Band[];
  columns: Column[];
  width: number;
  height: number;
}

const releaseYear = (entry: Entry) => (entry.releaseDate ? Number(entry.releaseDate.slice(0, 4)) : 9999);
const releaseMonth = (entry: Entry) =>
  entry.releaseDate && entry.releaseDate.length > 4 ? Number(entry.releaseDate.slice(5, 7)) : 13;

const columnKey = (entry: Entry, mode: Mode) => (mode === 'story' ? entry.inUniverseYear : releaseYear(entry));
const sortKey = (entry: Entry, mode: Mode) =>
  mode === 'story' ? entry.inUniverseYear * 100 : releaseYear(entry) * 100 + releaseMonth(entry);

function columnLabels(key: number, mode: Mode): { label: string; sublabel: string } {
  if (mode === 'story') {
    if (key < 0) return { label: `${Math.abs(key)} BC`, sublabel: 'antiquity' };
    if (key === 1260) return { label: 'Antiquity', sublabel: 'pre-history' };
    if (key >= 2028) return { label: 'Announced', sublabel: 'no in-universe date' };
    return { label: String(key), sublabel: 'in-universe year' };
  }
  if (key === 9999) return { label: 'TBA', sublabel: 'unscheduled' };
  return { label: String(key), sublabel: key >= 2026 ? 'scheduled' : 'release year' };
}

/**
 * Swimlane layout: one column per distinct year, one band per track, and inside
 * each band a greedy row packing so cards never overlap.
 */
export function computeLayout(entries: Entry[], tracks: Track[], mode: Mode): Layout {
  const keys = [...new Set(entries.map((e) => columnKey(e, mode)))].sort((a, b) => a - b);
  const xByKey = new Map(keys.map((key, index) => [key, PAD_X + index * COL_W]));

  const placed = new Map<string, PlacedEntry>();
  const bands: Band[] = [];
  let cursorY = PAD_TOP;

  for (const track of tracks) {
    const inTrack = entries
      .filter((e) => e.track === track.id)
      .sort((a, b) => sortKey(a, mode) - sortKey(b, mode));
    const rowEnds: number[] = [];

    for (const entry of inTrack) {
      const x = xByKey.get(columnKey(entry, mode))! - NODE_W / 2;
      let row = rowEnds.findIndex((end) => x - end > MIN_GAP);
      if (row < 0) {
        row = rowEnds.length;
        rowEnds.push(Number.NEGATIVE_INFINITY);
      }
      rowEnds[row] = x + NODE_W;
      placed.set(entry.id, { id: entry.id, x, y: cursorY + row * ROW_H, row });
    }

    const rows = Math.max(1, rowEnds.length);
    bands.push({ id: track.id, name: track.name, top: cursorY - 18, height: rows * ROW_H + 10 });
    cursorY += rows * ROW_H + BAND_GAP;
  }

  return {
    placed,
    bands,
    columns: keys.map((key) => ({ key, x: xByKey.get(key)!, ...columnLabels(key, mode) })),
    width: PAD_X + keys.length * COL_W + 140,
    height: cursorY + 70,
  };
}

/** Cubic bezier from the right edge of one card to the left edge of another. */
export function edgePath(from: PlacedEntry, to: PlacedEntry): string {
  const x1 = from.x + NODE_W;
  const y1 = from.y + NODE_H / 2;
  const x2 = to.x;
  const y2 = to.y + NODE_H / 2;
  const bend = Math.max(70, Math.abs(x2 - x1) * 0.45);
  return `M${x1},${y1} C${x1 + bend},${y1} ${x2 - bend},${y2} ${x2},${y2}`;
}
