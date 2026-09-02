import { z } from 'zod';

export const ENTRY_TYPES = ['film', 'series', 'special', 'oneshot', 'anim'] as const;
export const CONNECTION_KINDS = ['seq', 'setup', 'char', 'branch', 'inf'] as const;
export const CONFIDENCE = ['ok', 'approx', 'tv', 'future', 'pending', 'alt'] as const;
/** How an event relates to the entry's main span. */
export const EVENT_KINDS = ['main', 'flashback', 'timeTravel', 'epilogue'] as const;

export const trackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

/**
 * One dated moment inside an entry. `source` is required on purpose: an event
 * with no provenance is exactly the kind of thing this project refuses to ship.
 */
export const eventSchema = z.object({
  /** Sort key. Negative years are BC. */
  year: z.number().int(),
  /** What the reader sees: "5000 BC", "June 1943", "December 2013". */
  label: z.string().min(1),
  what: z.string().min(1),
  kind: z.enum(EVENT_KINDS),
  source: z.string().min(1),
});

export const entrySchema = z.object({
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be kebab-case'),
  title: z.string().min(1),
  /** Sort key for the in-universe axis. Negative values are BC. */
  inUniverseYear: z.number().int(),
  /** What the card actually shows — may be a range or a note. */
  inUniverseLabel: z.string().min(1),
  /** YYYY, YYYY-MM or YYYY-MM-DD. Null when nothing is scheduled. */
  releaseDate: z
    .string()
    .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
    .nullable(),
  track: z.string().min(1),
  type: z.enum(ENTRY_TYPES),
  /**
   * Marvel Studios phase. Null for Marvel Television titles, which sit on the
   * official timeline but were never part of the phase structure — inventing a
   * phase for them would be exactly the kind of guess this project refuses.
   */
  phase: z.number().int().min(1).max(6).nullable(),
  confidence: z.enum(CONFIDENCE),
  /** Null is meaningful: nothing verified was available, so nothing was written. */
  summary: z.string().nullable(),
  /**
   * Background for titles with no summary yet: a studio logline or reported
   * production facts. Never the plot of a finished work, and always surfaced
   * to the reader as non-canonical.
   */
  context: z.string().nullable().default(null),
  contextSource: z.enum(['official', 'reported']).nullable().default(null),
  /**
   * The span the story mainly occupies, used to draw it as a bar on the axis.
   * Flashbacks and time travel deliberately stay out of this and live in
   * `events`, so the bar never stretches across the whole map.
   */
  inUniverseStart: z.number().int(),
  inUniverseEnd: z.number().int(),
  events: z.array(eventSchema).default([]),
});

export const connectionSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.enum(CONNECTION_KINDS),
  note: z.string().min(1),
});

export const universeSchema = z
  .object({
    universe: z.object({ id: z.string(), name: z.string(), short: z.string() }),
    tracks: z.array(trackSchema).min(1),
    entries: z.array(entrySchema).min(1),
    connections: z.array(connectionSchema),
  })
  .superRefine((data, ctx) => {
    const ids = new Set(data.entries.map((e) => e.id));
    const slugs = new Set<string>();
    const trackIds = new Set(data.tracks.map((t) => t.id));

    for (const entry of data.entries) {
      if (slugs.has(entry.slug)) {
        ctx.addIssue({ code: 'custom', message: `duplicate slug: ${entry.slug}` });
      }
      slugs.add(entry.slug);
      if (!trackIds.has(entry.track)) {
        ctx.addIssue({ code: 'custom', message: `${entry.id} points at unknown track ${entry.track}` });
      }
      if (entry.confidence === 'future' && entry.summary) {
        ctx.addIssue({ code: 'custom', message: `${entry.id} is marked unreleased but carries a summary` });
      }
      if (entry.context && !entry.contextSource) {
        ctx.addIssue({ code: 'custom', message: `${entry.id} has context with no source label` });
      }
      if (entry.inUniverseEnd < entry.inUniverseStart) {
        ctx.addIssue({ code: 'custom', message: `${entry.id} ends before it starts` });
      }
      for (const event of entry.events) {
        if (!event.source.trim()) {
          ctx.addIssue({ code: 'custom', message: `${entry.id}: event "${event.what}" has no source` });
        }
      }
      const years = entry.events.map((e) => e.year);
      if (years.length !== new Set(years.map((y, i) => `${y}-${entry.events[i].what}`)).size) {
        ctx.addIssue({ code: 'custom', message: `${entry.id} has duplicate events` });
      }
    }
    for (const link of data.connections) {
      if (!ids.has(link.from)) ctx.addIssue({ code: 'custom', message: `connection from unknown id ${link.from}` });
      if (!ids.has(link.to)) ctx.addIssue({ code: 'custom', message: `connection to unknown id ${link.to}` });
      if (link.from === link.to) ctx.addIssue({ code: 'custom', message: `self-connection on ${link.from}` });
    }
  });

export const posterSchema = z.object({
  id: z.string(),
  resolved: z.literal(true),
  tmdbType: z.enum(['movie', 'tv']),
  tmdbId: z.number().int(),
  tmdbTitle: z.string(),
  tmdbDate: z.string().nullable(),
  posterPath: z.string().nullable(),
  backdropPath: z.string().nullable(),
});

export const posterManifestSchema = z.object({
  source: z.string().optional(),
  entries: z.record(z.string(), posterSchema),
});

export type Track = z.infer<typeof trackSchema>;
export type Entry = z.infer<typeof entrySchema>;
export type Connection = z.infer<typeof connectionSchema>;
export type Universe = z.infer<typeof universeSchema>;
export type Poster = z.infer<typeof posterSchema>;
export type TimelineEvent = z.infer<typeof eventSchema>;
