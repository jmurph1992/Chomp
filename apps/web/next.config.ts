import path from 'node:path'
import type { NextConfig } from 'next'
import { PrismaPlugin } from '@prisma/nextjs-monorepo-workaround-plugin'

/**
 * Next.js configuration.
 * - Images: allow Cloudflare Images delivery domain
 * - Transpile internal monorepo packages so Next.js compiles them correctly
 * - outputFileTracingRoot: without this, Next's file tracer roots itself at
 *   apps/web and never follows the symlink out to the pnpm workspace root's
 *   node_modules, where dependency files actually live.
 * - PrismaPlugin (webpack): Prisma's native query engine binary (a
 *   .so.node file, not a JS import) never made it into the deployed
 *   function in a pnpm monorepo on Vercel — every DB-touching route
 *   500'd in production with "could not locate the Query Engine" despite
 *   building and running fine locally
 *   (https://pris.ly/d/engine-not-found-nextjs). Generic Next config
 *   (serverExternalPackages, outputFileTracingIncludes) didn't fix it —
 *   confirmed via three separate real prod deploys. This is Prisma's own
 *   purpose-built webpack plugin for exactly this scenario; it hooks into
 *   webpack's copy step directly rather than relying on Next's/Vercel's
 *   file tracer to discover a native binary on its own.
 */
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@chomp/db', '@chomp/types', '@chomp/utils'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.plugins = [...config.plugins, new PrismaPlugin()]
    }
    return config
  },
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
