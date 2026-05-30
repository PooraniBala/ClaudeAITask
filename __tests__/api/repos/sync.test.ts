import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/repos/[repoId]/sync/route'
import { prisma } from '@/lib/prisma'
import { signJwt } from '@/lib/auth'

vi.mock('@/lib/sync', () => ({
  syncRepoMetrics: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/github', () => ({
  McpError: class McpError extends Error {
    code: string
    retryAfter?: number
    constructor(message: string, code: string, retryAfter?: number) {
      super(message)
      this.name = 'McpError'
      this.code = code
      this.retryAfter = retryAfter
    }
  },
}))

describe('POST /api/repos/:repoId/sync', () => {
  let userId: string
  let repoId: string
  let token: string

  beforeEach(async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')
    vi.mocked(syncRepoMetrics).mockResolvedValue(undefined)

    const user = await prisma.user.create({
      data: { email: 'syncroute@example.com', password_hash: 'hash' },
    })
    userId = user.id

    const repo = await prisma.repository.create({
      data: {
        github_id: 77001,
        name: 'sync-test-repo',
        full_name: 'owner/sync-test-repo',
        url: 'https://github.com/owner/sync-test-repo',
        owner_id: user.id,
      },
    })
    repoId = repo.id

    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'sync-route-session',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    token = await signJwt({ userId, email: user.email, sessionId: session.id })
  })

  function makeSyncRequest(rId: string, auth = true): NextRequest {
    return new NextRequest(`http://localhost/api/repos/${rId}/sync`, {
      method: 'POST',
      headers: auth ? { Cookie: `devpulse_session=${token}` } : {},
    })
  }

  it('calls syncRepoMetrics and returns 200 with synced:true', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')

    const req = makeSyncRequest(repoId)
    const res = await POST(req, { params: Promise.resolve({ repoId }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.synced).toBe(true)
    expect(syncRepoMetrics).toHaveBeenCalledWith(repoId, 'owner/sync-test-repo', '30d')
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = makeSyncRequest(repoId, false)
    const res = await POST(req, { params: Promise.resolve({ repoId }) })

    expect(res.status).toBe(401)
  })

  it('returns 404 if repoId does not belong to user', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'other@example.com', password_hash: 'hash' },
    })
    const otherRepo = await prisma.repository.create({
      data: {
        github_id: 77002,
        name: 'other-repo',
        full_name: 'other/repo',
        url: 'https://github.com/other/repo',
        owner_id: otherUser.id,
      },
    })

    const req = makeSyncRequest(otherRepo.id)
    const res = await POST(req, { params: Promise.resolve({ repoId: otherRepo.id }) })

    expect(res.status).toBe(404)
  })

  it('returns 429 when syncRepoMetrics throws McpError RATE_LIMITED', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')
    const { McpError } = await import('@/lib/github')

    vi.mocked(syncRepoMetrics).mockRejectedValueOnce(
      new McpError('rate limited', 'RATE_LIMITED', 90)
    )

    const req = makeSyncRequest(repoId)
    const res = await POST(req, { params: Promise.resolve({ repoId }) })
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.meta?.retryAfter).toBe(90)
  })

  it('returns 404 when syncRepoMetrics throws McpError NOT_FOUND', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')
    const { McpError } = await import('@/lib/github')

    vi.mocked(syncRepoMetrics).mockRejectedValueOnce(
      new McpError('not found', 'NOT_FOUND')
    )

    const req = makeSyncRequest(repoId)
    const res = await POST(req, { params: Promise.resolve({ repoId }) })

    expect(res.status).toBe(404)
  })

  it('returns lastSyncedAt from DB after successful sync', async () => {
    // Pre-set lastSyncedAt so the DB query returns it (syncRepoMetrics is mocked)
    const syncedAt = new Date()
    await prisma.repository.update({
      where: { id: repoId },
      data: { last_synced_at: syncedAt },
    })

    const req = makeSyncRequest(repoId)
    const res = await POST(req, { params: Promise.resolve({ repoId }) })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.synced).toBe(true)
    expect(body.data.lastSyncedAt).toBe(syncedAt.toISOString())
  })

  it('accepts period query param and passes it to syncRepoMetrics', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')

    const req = new NextRequest(`http://localhost/api/repos/${repoId}/sync?period=7d`, {
      method: 'POST',
      headers: { Cookie: `devpulse_session=${token}` },
    })
    await POST(req, { params: Promise.resolve({ repoId }) })

    expect(syncRepoMetrics).toHaveBeenCalledWith(repoId, 'owner/sync-test-repo', '7d')
  })
})
