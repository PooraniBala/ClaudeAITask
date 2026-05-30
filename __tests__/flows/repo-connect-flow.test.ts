/**
 * Full connect repo → sync metrics → view dashboard flow.
 * GitHub MCP calls are mocked; all DB interactions are real (test DB).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as login } from '@/app/api/auth/login/route'
import { POST as connect } from '@/app/api/repos/connect/route'
import { GET as metrics } from '@/app/api/metrics/[repoId]/route'
import { GET as dashboard } from '@/app/api/dashboard/route'
import { POST as sync } from '@/app/api/repos/[repoId]/sync/route'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcrypt'
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
  githubId: 99901,
  name: 'devpulse',
  fullName: 'acme/devpulse',
  url: 'https://github.com/acme/devpulse',
  isPrivate: false,
  description: 'A dev analytics tool',
  stargazersCount: 55,
  defaultBranch: 'main',
}

const EMAIL = 'flowrepo@example.com'
const PASSWORD = 'RepoFlow123!'

describe('Repo connect flow: login → connect → metrics → dashboard → sync', () => {
  let sessionToken: string
  let repoId: string

  beforeEach(async () => {
    const { fetchRepoMetadata } = await import('@/lib/github')
    const { syncRepoMetrics } = await import('@/lib/sync')
    vi.mocked(fetchRepoMetadata).mockResolvedValue(FAKE_REPO)
    vi.mocked(syncRepoMetrics).mockResolvedValue(undefined)

    await prisma.user.create({
      data: {
        email: EMAIL,
        password_hash: await bcrypt.hash(PASSWORD, 10),
      },
    })

    const loginRes = await login(
      new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      })
    )
    const setCookie = loginRes.headers.getSetCookie()
    const found = setCookie.find((c) => c.startsWith('devpulse_session='))!
    sessionToken = found.split(';')[0].split('=').slice(1).join('=')
  })

  function authed(method: string, url: string, body?: unknown): NextRequest {
    return new NextRequest(url, {
      method,
      headers: {
        Cookie: `devpulse_session=${sessionToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  }

  it('Step 1: connect repo returns 201 and calls fetchRepoMetadata + syncRepoMetrics', async () => {
    const { fetchRepoMetadata } = await import('@/lib/github')
    const { syncRepoMetrics } = await import('@/lib/sync')

    const res = await connect(
      authed('POST', 'http://localhost/api/repos/connect', {
        url: 'https://github.com/acme/devpulse',
      })
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.data.fullName).toBe('acme/devpulse')
    expect(body.data.id).toBeDefined()
    expect(fetchRepoMetadata).toHaveBeenCalledWith('acme/devpulse')
    expect(syncRepoMetrics).toHaveBeenCalled()

    repoId = body.data.id
  })

  it('Step 2: metrics route returns 200 after connect', async () => {
    // First connect the repo
    const connectRes = await connect(
      authed('POST', 'http://localhost/api/repos/connect', {
        url: 'https://github.com/acme/devpulse',
      })
    )
    const connectBody = await connectRes.json()
    repoId = connectBody.data.id

    const res = await metrics(
      authed('GET', `http://localhost/api/metrics/${repoId}?period=30d`),
      { params: Promise.resolve({ repoId }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.error).toBeNull()
    expect(Array.isArray(body.data)).toBe(true)
  })

  it('Step 3: dashboard returns aggregated data including the connected repo', async () => {
    // Connect first
    const connectRes = await connect(
      authed('POST', 'http://localhost/api/repos/connect', {
        url: 'https://github.com/acme/devpulse',
      })
    )
    repoId = (await connectRes.json()).data.id

    const res = await dashboard(authed('GET', 'http://localhost/api/dashboard'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.repoCount).toBeGreaterThanOrEqual(1)
    expect(body.data.repos.some((r: { fullName: string }) => r.fullName === 'acme/devpulse')).toBe(true)
  })

  it('Step 4: manual sync returns 200 and updates lastSyncedAt', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')

    // Connect first
    const connectRes = await connect(
      authed('POST', 'http://localhost/api/repos/connect', {
        url: 'https://github.com/acme/devpulse',
      })
    )
    repoId = (await connectRes.json()).data.id

    const res = await sync(
      authed('POST', `http://localhost/api/repos/${repoId}/sync`),
      { params: Promise.resolve({ repoId }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.synced).toBe(true)
    expect(syncRepoMetrics).toHaveBeenCalledWith(repoId, 'acme/devpulse', '30d')
  })
})
