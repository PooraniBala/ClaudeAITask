import { webcrypto } from 'node:crypto'
import '@testing-library/jest-dom/vitest'
import { beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'

// Polyfill Web Crypto API for jose and crypto.randomUUID() in Node 18 Vitest env
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: false,
  })
}

beforeEach(async () => {
  // Only run DB cleanup in node environment (API tests)
  if (typeof window === 'undefined') {
    await prisma.metric.deleteMany()
    await prisma.session.deleteMany()
    await prisma.repository.deleteMany()
    await prisma.user.deleteMany()
  }
})
