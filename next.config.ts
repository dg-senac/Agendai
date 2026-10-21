import type { NextConfig } from 'next';
import bundleAnalyzer from '@next/bundle-analyzer';

const withAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });

const config: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};

export default withAnalyzer(config);
