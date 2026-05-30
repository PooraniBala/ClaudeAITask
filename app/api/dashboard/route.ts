import { NextRequest, NextResponse } from 'next/server'
import { MetricType, MetricPeriod } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth, UnauthorizedError } from '@/lib/auth'
import type { ApiResponse, DashboardData, MetricInfo } from '@/lib/types'

type CommitPayload = { weeks?: Array<{ week: string; count: number }>; total_days?: number }
type PrPayload = { opened?: number; merged?: number; closed?: number; total_days?: number }
type ContributorPayload = {
  contributors?: Array<{ login: string; commits: number }>
  total_days?: number
}

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<DashboardData>>> {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth(req)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    throw err
  }

  const repos = await prisma.repository.findMany({
    where: { owner_id: session.userId },
    include: {
      metrics: {
        where: { period: MetricPeriod.THIRTY_DAYS },
        orderBy: { recorded_at: 'desc' },
      },
    },
  })

  let totalCommits = 0
  let openPrs = 0
  let topContributor: string | null = null
  let maxCommits = 0

  const repoSummaries: DashboardData['repos'] = repos.map((repo) => {
    const latestByType = new Map<MetricType, (typeof repo.metrics)[number]>()
    for (const m of repo.metrics) {
      if (!latestByType.has(m.type)) latestByType.set(m.type, m)
    }

    const commitMetric = latestByType.get(MetricType.COMMIT_FREQUENCY)
    if (commitMetric) {
      const p = commitMetric.payload as CommitPayload
      const weeklyTotal = (p.weeks ?? []).reduce((s, w) => s + w.count, 0)
      totalCommits += weeklyTotal
    }

    const prMetric = latestByType.get(MetricType.PR_STATS)
    if (prMetric) {
      const p = prMetric.payload as PrPayload
      openPrs += p.opened ?? 0
    }

    const contributorMetric = latestByType.get(MetricType.CONTRIBUTOR_ACTIVITY)
    if (contributorMetric) {
      const p = contributorMetric.payload as ContributorPayload
      for (const c of p.contributors ?? []) {
        if (c.commits > maxCommits) {
          maxCommits = c.commits
          topContributor = c.login
        }
      }
    }

    const latestMetrics: MetricInfo[] = [...latestByType.values()].map((m) => ({
      id: m.id,
      repoId: m.repo_id,
      type: m.type,
      period: m.period,
      payload: m.payload,
      recordedAt: m.recorded_at.toISOString(),
    }))

    return { id: repo.id, fullName: repo.full_name, latestMetrics }
  })

  const data: DashboardData = {
    totalCommits,
    openPrs,
    repoCount: repos.length,
    topContributor,
    repos: repoSummaries,
  }

  return NextResponse.json<ApiResponse<DashboardData>>(
    { data, error: null },
    { status: 200 }
  )
}
