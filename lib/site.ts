export const SITE = {
  name: 'GeekTimelines',
  domain: 'geektimelines.com',
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://geektimelines.com',
  tagline: 'Story maps for fictional universes',
  email: 'contactrundev@gmail.com',
  description:
    'Interactive, source-checked story maps for fictional universes. Every in-universe year and every connection is traced to a published source.',
  tmdbAttribution:
    'This product uses the TMDB API but is not endorsed or certified by TMDB.',
  /** Flip to false only when the launch is approved. */
  noindex: true,
} as const;

export const UNIVERSES = [
  { id: 'mcu', label: 'Marvel · MCU', href: '/', ready: true },
  { id: 'dc', label: 'DC', href: null, ready: false },
  { id: 'starwars', label: 'Star Wars', href: null, ready: false },
  { id: 'middleearth', label: 'Middle-earth', href: null, ready: false },
] as const;
