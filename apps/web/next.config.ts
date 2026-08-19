import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * Next.js configuration.
 * - Images: allow Cloudflare Images delivery domain
 * - Transpile internal monorepo packages so Next.js compiles them correctly
 * - outputFileTracingRoot: without this, Next's file tracer roots itself at
 *   apps/web and never follows the symlink out to the pnpm workspace root's
 *   node_modules — needed regardless of serverExternalPackages below, since
 *   other traced files (e.g. Prisma's generated JS client itself) still
 *   live out there too.
 * - serverExternalPackages: Next's per-file tracer doesn't reliably pick up
 *   Prisma's native query engine binary (a .so.node file, not a JS import)
 *   in a pnpm monorepo — every DB-touching route 500'd in production with
 *   "could not locate the Query Engine" despite building and running fine
 *   locally (https://pris.ly/d/engine-not-found-nextjs). Marking just
 *   @prisma/client external makes Vercel copy its whole resolved directory
 *   (engine binary included) instead of relying on that tracer. @chomp/db
 *   itself stays in transpilePackages below — it's plain TS source with no
 *   native binary of its own, so it still needs transpiling, not
 *   externalizing.
 */
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../..'),
  serverExternalPackages: ['@prisma/client'],
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
