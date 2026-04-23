import { config } from 'dotenv';
config({ path: '../../.env.local' });

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['lvh.me', '*.lvh.me'],
};

export default nextConfig;