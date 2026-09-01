import { z } from 'zod';

export const ENTRY_TYPES = ['film', 'series', 'special', 'oneshot', 'anim'] as const;
export const CONNECTION_KINDS = ['seq', 'setup', 'char', 'branch', 'inf'] as const;
export const CONFIDENCE = ['ok', 'approx', 'tv', 'future', 'pending', 'alt'] as const;

export const trackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
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
  phase: z.number().int().min(1).max(6),
  confidence: z.enum(CONFIDENCE),
  /** Null is meaningful: nothing verified was available, so nothing was written. */
  summary: z.string().nullable(),
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
