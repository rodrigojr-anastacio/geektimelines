import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy policy',
  description: `How ${SITE.name} handles data, cookies and advertising.`,
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <main className="page">
      <h1>Privacy policy</h1>
      <p className="lede">Short version: no account, no tracking of you personally, and nothing sold.</p>

      <h2>What is collected</h2>
      <p>
        {SITE.name} has no sign-up, no login and no user profiles. Browsing the maps does not create a
        record tied to you. The only thing stored in your browser is a single local preference
        remembering your answer to the cookie notice.
      </p>

      <h2>Advertising</h2>
      <p>
        This site is funded by advertising. Ad slots are reserved in the layout, but no advertising
        network is active yet. When Google AdSense is enabled, Google and its partners may use cookies
        to serve ads based on your visits to this and other sites. You can opt out of personalised
        advertising through{' '}
        <a href="https://adssettings.google.com" rel="noreferrer noopener" target="_blank">Google Ads Settings</a>,
        and review how Google uses data at{' '}
        <a href="https://policies.google.com/technologies/partner-sites" rel="noreferrer noopener" target="_blank">
          policies.google.com/technologies/partner-sites
        </a>.
      </p>
      <p>
        Until you accept the cookie notice, no advertising cookies are set. Declining keeps the site
        fully usable.
      </p>

      <h2>Analytics</h2>
      <p>
        Aggregate, cookieless traffic measurement is used to see which pages are read. It sets no
        cookies, does not follow you across other sites, and is never combined with anything that
        identifies you individually.
      </p>

      <h2>Third parties</h2>
      <p>
        Poster artwork is loaded from an external image host, which receives the request for the image
        as any image host would, and the site itself is hosted by a third-party platform that processes
        requests to deliver these pages. Neither receives anything that identifies you beyond what a
        normal web request carries.
      </p>

      <h2>Your choices</h2>
      <p>
        You can clear the stored preference at any time by clearing this site&rsquo;s data in your
        browser. Questions go through the <Link href="/contact">contact page</Link>.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes in a way that affects what is collected, the notice will appear again
        rather than changing quietly.
      </p>
    </main>
  );
}
