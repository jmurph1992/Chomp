import { PrismaClient } from '@prisma/client'

/**
 * Global singleton pattern for PrismaClient.
 * Prevents exhausting the connection pool in development due to hot reloads.
 * In production, module caching handles this naturally.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Re-export Prisma types so consumers don't need to import @prisma/client directly
export type { Prisma, User } from '@prisma/client'
export {
  UserRole,
  OperatorRole,
} from '@prisma/client'
