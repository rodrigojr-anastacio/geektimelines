import { ImageResponse } from 'next/og';
import { entries } from '@/lib/data';
import { SITE } from '@/lib/site';

export const alt = `${SITE.name} — Marvel Cinematic Universe story map`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage() {
  const connections = 77;
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#f7f6f3',
          padding: '72px 76px',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 30, letterSpacing: 4, color: '#16150f', display: 'flex' }}>
            <span>GEEK</span>
            <span style={{ color: '#a2381f' }}>TIMELINES</span>
          </div>
          <div style={{ fontSize: 68, color: '#16150f', marginTop: 40, lineHeight: 1.05, maxWidth: 900 }}>
            The Marvel Cinematic Universe, drawn as one map
          </div>
          <div style={{ fontSize: 27, color: '#4a4740', marginTop: 26, maxWidth: 860, lineHeight: 1.4 }}>
            Every film, series, one-shot and special — and the connections between them, traced to
            published sources.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 46, fontSize: 22, color: '#817d73', letterSpacing: 1 }}>
          <span>{entries.length} ENTRIES</span>
          <span>{connections} CONNECTIONS</span>
          <span>IN-UNIVERSE &amp; RELEASE ORDER</span>
        </div>
      </div>
    ),
    size,
  );
}
