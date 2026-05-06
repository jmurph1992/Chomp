import type { NextConfig } from 'next'

/**
 * Next.js configuration.
 * - Images: allow Cloudflare Images delivery domain
 * - Transpile internal monorepo packages so Next.js compiles them correctly
 */
const nextConfig: NextConfig = {
  transpilePackages: ['@chomp/db', '@chomp/types', '@chomp/utils'],
  images: {
    remotePatterns: [
      {
        // Cloudflare Images delivery hostname
        protocol: 'https',
        hostname: 'imagedelivery.net',
      },
    ],
  },
}

export default nextConfig
