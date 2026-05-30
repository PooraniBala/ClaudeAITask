import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/repos/connect/route'
import { prisma } from '@/lib/prisma'
import { signJwt } from '@/lib/auth'
import type { RepoMetadata } from '@/lib/github'

vi.mock('@/lib/github', () => ({
  fetchRepoMetadata: vi.fn(),
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

vi.mock('@/lib/sync', () => ({
  syncRepoMetrics: vi.fn().mockResolvedValue(undefined),
}))

const FAKE_REPO: RepoMetadata = {
  githubId: 555001,
  name: 'cool-project',
  fullName: 'testowner/cool-project',
  url: 'https://github.com/testowner/cool-project',
  isPrivate: false,
  description: 'A cool project',
  stargazersCount: 10,
  defaultBranch: 'main',
}

describe('POST /api/repos/connect', () => {
  let userId: string
  let token: string

  beforeEach(async () => {
    const { fetchRepoMetadata } = await import('@/lib/github')
    const { syncRepoMetrics } = await import('@/lib/sync')
    vi.mocked(fetchRepoMetadata).mockResolvedValue(FAKE_REPO)
    vi.mocked(syncRepoMetrics).mockResolvedValue(undefined)

    const user = await prisma.user.create({
      data: { email: 'connectuser@example.com', password_hash: 'hash' },
    })
    userId = user.id
    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'connect-test-session',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    token = await signJwt({ userId, email: user.email, sessionId: session.id })
  })

  function makeConnectRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/repos/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `devpulse_session=${token}`,
      },
      body: JSON.stringify(body),
    })
  }

  it('creates repo and returns 201 with repo object for valid GitHub URL', async () => {
    const req = makeConnectRequest({
      url: 'https://github.com/testowner/cool-project',
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.fullName).toBe('testowner/cool-project')
    expect(body.data.id).toBeDefined()
  })

  it('triggers fetchRepoMetadata and syncRepoMetrics on connect', async () => {
    const { fetchRepoMetadata } = await import('@/lib/github')
    const { syncRepoMetrics } = await import('@/lib/sync')

    const req = makeConnectRequest({
      url: 'https://github.com/testowner/cool-project',
    })
    await POST(req)

    expect(fetchRepoMetadata).toHaveBeenCalledWith('testowner/cool-project')
    expect(syncRepoMetrics).toHaveBeenCalledWith(
      expect.any(String),
      'testowner/cool-project',
      '30d'
    )
  })

  it('returns 404 when McpError NOT_FOUND is thrown', async () => {
    const { fetchRepoMetadata, McpError } = await import('@/lib/github')
    vi.mocked(fetchRepoMetadata).mockRejectedValueOnce(
      new McpError('Repository not found or access denied', 'NOT_FOUND')
    )

    const req = makeConnectRequest({
      url: 'https://github.com/testowner/missing-repo',
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.data).toBeNull()
    expect(body.error).toContain('not found')
  })

  it('returns 429 with retryAfter when McpError RATE_LIMITED is thrown', async () => {
    const { fetchRepoMetadata, McpError } = await import('@/lib/github')
    vi.mocked(fetchRepoMetadata).mockRejectedValueOnce(
      new McpError('rate limited', 'RATE_LIMITED', 120)
    )

    const req = makeConnectRequest({
      url: 'https://github.com/testowner/cool-project',
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(429)
    expect(body.meta?.retryAfter).toBe(120)
  })

  it('returns 422 for an invalid URL', async () => {
    const req = makeConnectRequest({ url: 'not-a-url' })
    const res = await POST(req)

    expect(res.status).toBe(422)
  })

  it('returns 422 for a non-GitHub URL', async () => {
    const req = makeConnectRequest({ url: 'https://gitlab.com/owner/repo' })
    const res = await POST(req)

    expect(res.status).toBe(422)
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = new NextRequest('http://localhost/api/repos/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/owner/repo' }),
    })
    const res = await POST(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/repos/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `devpulse_session=${token}`,
      },
      body: 'not-json{{',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('re-connects same repo (upsert — no 409 conflict)', async () => {
    const req1 = makeConnectRequest({ url: 'https://github.com/testowner/cool-project' })
    const req2 = makeConnectRequest({ url: 'https://github.com/testowner/cool-project' })

    const res1 = await POST(req1)
    const res2 = await POST(req2)

    expect(res1.status).toBe(201)
    expect(res2.status).toBe(201)
  })

  it('returns 201 even when syncRepoMetrics throws a non-McpError (sync failure is non-fatal)', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')
    vi.mocked(syncRepoMetrics).mockRejectedValueOnce(new Error('DB connection lost'))

    const req = makeConnectRequest({ url: 'https://github.com/testowner/cool-project' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.fullName).toBe('testowner/cool-project')
  })

  it('returns 429 when syncRepoMetrics throws McpError RATE_LIMITED', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')
    const { McpError } = await import('@/lib/github')
    vi.mocked(syncRepoMetrics).mockRejectedValueOnce(
      new McpError('rate limited during sync', 'RATE_LIMITED', 60)
    )

    const req = makeConnectRequest({ url: 'https://github.com/testowner/cool-project' })
    const res = await POST(req)

    expect(res.status).toBe(429)
  })

  it('returns 422 when URL has fewer than 2 path segments', async () => {
    const req = makeConnectRequest({ url: 'https://github.com/onlyone' })
    const res = await POST(req)

    expect(res.status).toBe(422)
  })
})
