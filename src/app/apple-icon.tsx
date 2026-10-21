import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(140deg,#6557ec,#4338ca)', color: '#fff', fontSize: 104, fontWeight: 800, fontFamily: 'Arial' }}>
        a
      </div>
    ),
    size,
  );
}
