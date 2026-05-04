import { config } from 'dotenv';
config({ path: '../../.env.local' });

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // CSRF protection is handled automatically by NextAuth v5 in production (NODE_ENV=production)
  // No explicit configuration needed - NextAuth enables CSRF by default
  allowedDevOrigins: ['lvh.me', '*.lvh.me'],
};

export default nextConfig;