// No published types for this package (see next.config.ts for why it's needed).
declare module '@prisma/nextjs-monorepo-workaround-plugin' {
  export class PrismaPlugin {
    apply(compiler: unknown): void
  }
}
