import { ImageResponse } from 'next/og';

export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

/**
 * Favicon. It has to survive being 16px tall on a dark browser chrome, so it is
 * a solid accent tile with a single high-contrast letter rather than anything
 * with fine detail.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#a2381f',
          color: '#f7f6f3',
          fontSize: 46,
          fontFamily: 'Georgia, serif',
          fontWeight: 700,
          letterSpacing: -2,
        }}
      >
        G
      </div>
    ),
    size,
  );
}
