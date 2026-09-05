import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/react';
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import Link from 'next/link';
import { SITE, UNIVERSES } from '@/lib/site';
import CookieNotice from '@/components/CookieNotice';
import './globals.css';

const display = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  variable: '--font-display',
  display: 'swap',
});
const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name} — ${SITE.tagline}`, template: `%s · ${SITE.name}` },
  description: SITE.description,
  openGraph: { siteName: SITE.name, type: 'website', locale: 'en_US' },
  robots: SITE.noindex ? { index: false, follow: false } : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="wordmark">
            Geek<em>Timelines</em>
          </Link>
          <nav className="universes" aria-label="Universes">
            {UNIVERSES.map((u) =>
              u.href ? (
                <Link key={u.id} href={u.href} className="universe-link" data-active={u.ready}>
                  {u.label}
                </Link>
              ) : (
                <span key={u.id} className="universe-link" aria-disabled="true" title="Coming soon">
                  {u.label}
                </span>
              ),
            )}
          </nav>
          <span className="grow" />
          <Link href="/sources" className="text-link">
            Method
          </Link>
        </header>

        {children}

        <footer className="site-footer">
          <div className="footer-grid">
            <div>
              <Link href="/" className="wordmark" style={{ fontSize: 18 }}>
                Geek<em>Timelines</em>
              </Link>
              <p className="footer-note">
                Interactive, source-checked story maps for fictional universes. Estimated dates are
                marked, unreleased titles carry no invented plot, and inferred links are drawn apart
                from confirmed ones.
              </p>
              <p className="footer-fine">
                Unofficial fan project. Marvel, MCU and all related titles are trademarks of Marvel /
                The Walt Disney Company. No affiliation.
              </p>
            </div>
            <div>
              <h4>Universes</h4>
              <Link href="/">Marvel · MCU</Link>
              <span style={{ display: 'block', color: 'var(--ink-25)', padding: '3px 0' }}>DC — soon</span>
              <span style={{ display: 'block', color: 'var(--ink-25)', padding: '3px 0' }}>Star Wars — soon</span>
            </div>
            <div>
              <h4>About</h4>
              <Link href="/about">About</Link>
              <Link href="/sources">Sources &amp; method</Link>
              <Link href="/privacy">Privacy</Link>
              <Link href="/contact">Contact</Link>
            </div>
          </div>
        </footer>

        <CookieNotice />
        {/* The /react entry, not /next.
            The Next-specific component mounted and created window.va, but never
            appended its script tag, so nothing was ever measured and the Vercel
            dashboard stayed on its "Get Started" screen. It reads a base path
            from NEXT_PUBLIC_VERCEL_OBSERVABILITY_BASEPATH, which this project
            does not have; the /react entry resolves the endpoint itself.

            Note when debugging this: the served script refuses to send anything
            when navigator.webdriver is set or the user agent says Headless, so
            an automated check always sees zero beacons even when it is working.
            Verifying needs a real visit. */}
        <Analytics />
      </body>
    </html>
  );
}
