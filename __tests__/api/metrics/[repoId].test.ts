import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/metrics/[repoId]/route'
import { prisma } from '@/lib/prisma'
import { signJwt } from '@/lib/auth'
import { MetricType, MetricPeriod } from '@prisma/client'

vi.mock('@/lib/sync', () => ({
  syncRepoMetrics: vi.fn().mockResolvedValue(undefined),
}))

describe('GET /api/metrics/[repoId]', () => {
  let userId: string
  let repoId: string
  let token: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: 'metricsuser@example.com', password_hash: 'hash' },
    })
    userId = user.id
    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'metrics-test-session',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    token = await signJwt({ userId, email: user.email, sessionId: session.id })

    const repo = await prisma.repository.create({
      data: {
        github_id: 777001,
        name: 'metrics-repo',
        full_name: 'metricsuser/metrics-repo',
        url: 'https://github.com/metricsuser/metrics-repo',
        is_private: false,
        owner_id: userId,
      },
    })
    repoId = repo.id
  })

  function makeRequest(rId: string, query = ''): NextRequest {
    return new NextRequest(
      `http://localhost/api/metrics/${rId}${query ? `?${query}` : ''}`,
      { headers: { Cookie: `devpulse_session=${token}` } }
    )
  }

  it('returns metrics for valid repoId and period query param', async () => {
    await prisma.metric.create({
      data: {
        repo_id: repoId,
        type: MetricType.COMMIT_FREQUENCY,
        period: MetricPeriod.THIRTY_DAYS,
        payload: { total: 42 },
        recorded_at: new Date(),
      },
    })

    const req = makeRequest(repoId, 'period=30d')
    const res = await GET(req, {
      params: Promise.resolve({ repoId }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.length).toBeGreaterThan(0)
  })

  it('returns empty data when no metrics exist yet', async () => {
    const req = makeRequest(repoId, 'period=7d')
    const res = await GET(req, {
      params: Promise.resolve({ repoId }),
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.meta.synced).toBe(false)
  })

  it('returns 422 for an invalid period value', async () => {
    const req = makeRequest(repoId, 'period=999d')
    const res = await GET(req, {
      params: Promise.resolve({ repoId }),
    })

    expect(res.status).toBe(422)
  })

  it('returns 404 when repoId does not belong to the user', async () => {
    const other = await prisma.user.create({
      data: { email: 'stranger@example.com', password_hash: 'hash' },
    })
    const otherRepo = await prisma.repository.create({
      data: {
        github_id: 777002,
        name: 'strangers-repo',
        full_name: 'stranger/strangers-repo',
        url: 'https://github.com/stranger/strangers-repo',
        is_private: true,
        owner_id: other.id,
      },
    })

    const req = makeRequest(otherRepo.id, 'period=30d')
    const res = await GET(req, {
      params: Promise.resolve({ repoId: otherRepo.id }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = new NextRequest(`http://localhost/api/metrics/${repoId}`)
    const res = await GET(req, { params: Promise.resolve({ repoId }) })

    expect(res.status).toBe(401)
  })

  it('triggers syncRepoMetrics when no metrics exist (stale)', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')
    vi.mocked(syncRepoMetrics).mockClear()

    const req = makeRequest(repoId, 'period=30d')
    await GET(req, { params: Promise.resolve({ repoId }) })

    expect(syncRepoMetrics).toHaveBeenCalledWith(repoId, 'metricsuser/metrics-repo', '30d')
  })

  it('does NOT re-sync when metrics exist and lastSyncedAt is recent', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')
    vi.mocked(syncRepoMetrics).mockClear()

    // Set lastSyncedAt to 30 minutes ago (within 1-hour threshold)
    await prisma.repository.update({
      where: { id: repoId },
      data: { last_synced_at: new Date(Date.now() - 30 * 60 * 1000) },
    })
    await prisma.metric.create({
      data: {
        repo_id: repoId,
        type: MetricType.COMMIT_FREQUENCY,
        period: MetricPeriod.THIRTY_DAYS,
        payload: { weeks: [], total_days: 30 },
        recorded_at: new Date(),
      },
    })

    const req = makeRequest(repoId, 'period=30d')
    await GET(req, { params: Promise.resolve({ repoId }) })

    expect(syncRepoMetrics).not.toHaveBeenCalled()
  })

  it('re-syncs when lastSyncedAt is more than 1 hour ago', async () => {
    const { syncRepoMetrics } = await import('@/lib/sync')
    vi.mocked(syncRepoMetrics).mockClear()

    await prisma.repository.update({
      where: { id: repoId },
      data: { last_synced_at: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    })
    await prisma.metric.create({
      data: {
        repo_id: repoId,
        type: MetricType.COMMIT_FREQUENCY,
        period: MetricPeriod.THIRTY_DAYS,
        payload: { weeks: [], total_days: 30 },
        recorded_at: new Date(),
      },
    })

    const req = makeRequest(repoId, 'period=30d')
    await GET(req, { params: Promise.resolve({ repoId }) })

    expect(syncRepoMetrics).toHaveBeenCalled()
  })

  it('returns meta.synced=true when repo has lastSyncedAt', async () => {
    await prisma.repository.update({
      where: { id: repoId },
      data: { last_synced_at: new Date() },
    })
    await prisma.metric.create({
      data: {
        repo_id: repoId,
        type: MetricType.COMMIT_FREQUENCY,
        period: MetricPeriod.THIRTY_DAYS,
        payload: { weeks: [], total_days: 30 },
        recorded_at: new Date(),
      },
    })

    const req = makeRequest(repoId, 'period=30d')
    const res = await GET(req, { params: Promise.resolve({ repoId }) })
    const body = await res.json()

    expect(body.meta.synced).toBe(true)
  })

  it('returns 200 for period=7d', async () => {
    const req = makeRequest(repoId, 'period=7d')
    const res = await GET(req, { params: Promise.resolve({ repoId }) })

    expect(res.status).toBe(200)
  })

  it('returns 200 for period=90d', async () => {
    const req = makeRequest(repoId, 'period=90d')
    const res = await GET(req, { params: Promise.resolve({ repoId }) })

    expect(res.status).toBe(200)
  })
})
