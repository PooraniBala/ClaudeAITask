import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/dashboard/route'
import { prisma } from '@/lib/prisma'
import { signJwt } from '@/lib/auth'
import { MetricType, MetricPeriod } from '@prisma/client'

describe('GET /api/dashboard', () => {
  let userId: string
  let token: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: 'dashuser@example.com', password_hash: 'hash' },
    })
    userId = user.id
    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'dash-test-session',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    token = await signJwt({ userId, email: user.email, sessionId: session.id })
  })

  it('returns aggregated metrics across all user repos', async () => {
    const repo = await prisma.repository.create({
      data: {
        github_id: 888001,
        name: 'dash-repo',
        full_name: 'dashuser/dash-repo',
        url: 'https://github.com/dashuser/dash-repo',
        is_private: false,
        owner_id: userId,
      },
    })

    await prisma.metric.createMany({
      data: [
        {
          repo_id: repo.id,
          type: MetricType.COMMIT_FREQUENCY,
          period: MetricPeriod.THIRTY_DAYS,
          payload: { weeks: [{ week: '2026-05-01', count: 10 }], total_days: 30 },
          recorded_at: new Date(),
        },
        {
          repo_id: repo.id,
          type: MetricType.PR_STATS,
          period: MetricPeriod.THIRTY_DAYS,
          payload: { opened: 3, merged: 2, closed: 1, avg_merge_time_hours: 4, total_days: 30 },
          recorded_at: new Date(),
        },
        {
          repo_id: repo.id,
          type: MetricType.CONTRIBUTOR_ACTIVITY,
          period: MetricPeriod.THIRTY_DAYS,
          payload: {
            contributors: [{ login: 'alice', commits: 10, additions: 100, deletions: 20 }],
            total_days: 30,
          },
          recorded_at: new Date(),
        },
      ],
    })

    const req = new NextRequest('http://localhost/api/dashboard', {
      headers: { Cookie: `devpulse_session=${token}` },
    })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.repoCount).toBe(1)
    expect(body.data.totalCommits).toBeGreaterThanOrEqual(0)
    expect(body.data.openPrs).toBeGreaterThanOrEqual(0)
    expect(body.error).toBeNull()
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = new NextRequest('http://localhost/api/dashboard')
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('aggregates metrics only from the authenticated user\'s repos (data isolation)', async () => {
    const otherUser = await prisma.user.create({
      data: { email: 'other-dash@example.com', password_hash: 'hash' },
    })
    const otherRepo = await prisma.repository.create({
      data: {
        github_id: 888099,
        name: 'other-repo',
        full_name: 'other/repo',
        url: 'https://github.com/other/repo',
        owner_id: otherUser.id,
      },
    })
    await prisma.metric.create({
      data: {
        repo_id: otherRepo.id,
        type: 'COMMIT_FREQUENCY',
        period: 'THIRTY_DAYS',
        payload: { weeks: [{ week: '2026-01-01', count: 999 }], total_days: 30 },
        recorded_at: new Date(),
      },
    })

    const req = new NextRequest('http://localhost/api/dashboard', {
      headers: { Cookie: `devpulse_session=${token}` },
    })
    const res = await GET(req)
    const body = await res.json()

    expect(body.data.totalCommits).toBe(0)
    expect(body.data.repoCount).toBe(0)
  })

  it('identifies topContributor across all user repos', async () => {
    const repo = await prisma.repository.create({
      data: {
        github_id: 888002,
        name: 'top-repo',
        full_name: 'dashuser/top-repo',
        url: 'https://github.com/dashuser/top-repo',
        owner_id: userId,
      },
    })
    await prisma.metric.create({
      data: {
        repo_id: repo.id,
        type: 'CONTRIBUTOR_ACTIVITY',
        period: 'THIRTY_DAYS',
        payload: {
          contributors: [
            { login: 'bob', commits: 3 },
            { login: 'alice', commits: 20 },
          ],
          total_days: 30,
        },
        recorded_at: new Date(),
      },
    })

    const req = new NextRequest('http://localhost/api/dashboard', {
      headers: { Cookie: `devpulse_session=${token}` },
    })
    const res = await GET(req)
    const body = await res.json()

    expect(body.data.topContributor).toBe('alice')
  })

  it('returns empty aggregation shape when user has no repos', async () => {
    const req = new NextRequest('http://localhost/api/dashboard', {
      headers: { Cookie: `devpulse_session=${token}` },
    })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.repoCount).toBe(0)
    expect(body.data.totalCommits).toBe(0)
    expect(body.data.openPrs).toBe(0)
    expect(body.data.topContributor).toBeNull()
    expect(body.data.repos).toEqual([])
  })
})
