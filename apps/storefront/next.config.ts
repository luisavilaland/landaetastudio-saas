import { config } from 'dotenv';
config({ path: '../../.env.local' });

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['lvh.me', '*.lvh.me'],
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '*.lvh.me',
        port: '9000',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'host.docker.internal',
        port: '9000',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;