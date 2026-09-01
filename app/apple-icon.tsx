import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
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
          fontSize: 124,
          fontFamily: 'Georgia, serif',
          fontWeight: 700,
          letterSpacing: -6,
        }}
      >
        G
      </div>
    ),
    size,
  );
}
