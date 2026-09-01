import type { Metadata } from 'next';
import StoryMap from '@/components/StoryMap';
import { entries, tracks, connections, posterUrl } from '@/lib/data';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Marvel Cinematic Universe — interactive story map',
  description:
    'Every MCU film, series, one-shot and special on one pan-and-zoom map, in in-universe or release order, with the connections between them traced to published sources.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  const posters = Object.fromEntries(entries.map((entry) => [entry.id, posterUrl(entry.id, 'w342')]));

  return (
    <main>
      {/* AdSense slot — top leaderboard, reserved space only */}
      <div className="ad-slot ad-leaderboard" data-ad-slot="leaderboard" />
      <h1 className="visually-hidden">{SITE.name} — Marvel Cinematic Universe story map</h1>
      <StoryMap entries={entries} tracks={tracks} connections={connections} posters={posters} />
    </main>
  );
}
