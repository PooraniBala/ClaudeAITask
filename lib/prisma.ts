import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { _prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma._prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma._prisma = prisma
}
