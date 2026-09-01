import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sources & method',
  description:
    'How the GeekTimelines story maps are built: where the chronology comes from, which years are confirmed, which are estimated, and what is deliberately left blank.',
  alternates: { canonical: '/sources' },
};

export default function SourcesPage() {
  return (
    <main className="page">
      <h1>Sources &amp; method</h1>
      <p className="lede">
        Every year, link and label on the map is traced to a published source. Estimates are marked
        rather than smoothed over.
      </p>

      <h2>Order and dates</h2>
      <p>
        <strong>Chronological order</strong> follows the <em>MCU Complete Timeline</em> published by
        Marvel / Disney+, which covers feature films, Disney+ seasons, Marvel Studios One-Shots,
        specials and the animated titles Marvel currently counts.
      </p>
      <p>
        <strong>In-universe years</strong> come from Marvel&rsquo;s own{' '}
        <em>The Marvel Cinematic Universe: An Official Timeline</em> (2023) or from dates stated on
        screen. Where a year is only a fan or press consensus, the card is marked <strong>≈</strong>{' '}
        and the entry page says so in full.
      </p>
      <p>
        <strong>Release dates</strong> are theatrical and streaming premiere dates, verified against
        TMDB. Dates from 2026 onward are scheduled and may shift.
      </p>

      <h2>Chronology inside an entry</h2>
      <p>
        A story is rarely a single year. <em>The First Avenger</em> runs from 1943 to 1945 and then
        wakes up in 2011; <em>Endgame</em> lives in 2018 and 2023 and reaches back into 1970, 2012,
        2013 and 2014; <em>Eternals</em> crosses seven thousand years. On the map an entry is drawn as
        a bar covering the years its story mainly occupies, and everything outside that span is listed
        as a chronology on the entry itself, labelled as a flashback, a piece of time travel, or an
        epilogue.
      </p>
      <p>
        Flashbacks are deliberately not moved on the map. Scattering a single film across six points
        would make the timeline unreadable and would misrepresent where the story actually sits.
      </p>
      <p>
        <strong>Every dated event carries its source, printed next to it.</strong> Three are in use:{' '}
        <em>Shown on screen</em> for dates the film or series states outright in a title card,{' '}
        <em>Marvel official timeline (2023)</em> for Marvel&rsquo;s own published book, and{' '}
        <em>Popverse MCU timeline</em> for the dated chronology published by Popverse. An event with no
        source does not get written down.
      </p>

      <h2>What is never invented</h2>
      <p>
        Summaries describe only what happens on screen. A title that has been announced but has no
        released material carries <strong>⧗</strong> and no summary. A title that is out but has no
        verified summary here also carries <strong>⧗</strong>, with a note saying exactly that.
      </p>
      <p>
        Connections drawn as solid or dashed lines are script facts: a direct continuation, a
        post-credits setup, a character crossing over, a multiverse branch. Connections that are only
        announced or reasonably inferred are drawn in the faintest weight and labelled as such. They
        are never mixed in with the confirmed ones.
      </p>

      <h2>Known disputes, flagged on the cards</h2>
      <p>
        The placement of <em>Eternals</em> and <em>Black Widow</em>; the &ldquo;8 years&rdquo; line in{' '}
        <em>Spider-Man: Homecoming</em> that contradicts the official chronology; Marvel Television
        productions such as <em>Agent Carter</em>; and the titles that sit off the main axis —{' '}
        <em>Loki</em> and the TVA, <em>What If…?</em>, <em>Marvel Zombies</em>, and{' '}
        <em>The Fantastic Four: First Steps</em> on its own Earth.
      </p>

      <h2>Sources</h2>
      <ul>
        <li>Marvel.com / Disney+ — <em>MCU Complete Timeline</em> viewing guide</li>
        <li>ScreenRant — MCU chronological order with the years from Marvel&rsquo;s official 2023 timeline book</li>
        <li>Rotten Tomatoes Editorial and Vandal — chronological order, updated 2026</li>
        <li>GamesRadar / TechRadar — confirmed anchors (2012, 2018, 2023) and ambiguous placements</li>
        <li>TMDB — release dates, titles and artwork</li>
        <li>
          <a href="https://www.thepopverse.com/marvel-mcu-timeline-cinematic-universe-studios-order-phase-6-5-4-3-2-1-order" rel="noreferrer noopener" target="_blank">
            Popverse
          </a>{' '}
          — the dated event-by-event MCU chronology, including flashbacks and time travel
        </li>
        <li>
          Structure cross-checked against the <em>Marvel Story Map</em> (DeviantArt), the multiverse
          infographic covered by ScreenRant, Lucen Software&rsquo;s phase chart, Letterboxd watch-order
          lists and the MCU Fandom timeline
        </li>
      </ul>

      <h2>Out of scope</h2>
      <p>
        Comics are deliberately excluded. A trustworthy comics chronology needs its own dataset built
        around events and tie-ins, not a single line, and adding one badly would undermine everything
        else here.
      </p>

      <h2>Found a mistake?</h2>
      <p>
        Send it in through the <Link href="/contact">contact page</Link> with the source, and it gets
        fixed.
      </p>
    </main>
  );
}
