import { MetricType, MetricPeriod } from '@prisma/client'
import { prisma } from './prisma'
import {
  fetchCommitFrequency,
  fetchPrStats,
  fetchContributors,
  McpError,
} from './github'
import { periodToDbEnum } from './validators'
import type {
  CommitFrequencyPayload,
  PrStatsPayload,
  ContributorPayload,
} from './types'

async function upsertMetric(
  repoId: string,
  type: MetricType,
  period: MetricPeriod,
  payload: CommitFrequencyPayload | PrStatsPayload | ContributorPayload
): Promise<void> {
  const existing = await prisma.metric.findFirst({
    where: { repo_id: repoId, type, period },
    select: { id: true },
  })

  if (existing) {
    await prisma.metric.update({
      where: { id: existing.id },
      data: { payload, recorded_at: new Date() },
    })
  } else {
    await prisma.metric.create({
      data: { repo_id: repoId, type, period, payload, recorded_at: new Date() },
    })
  }
}

export async function syncRepoMetrics(
  repoId: string,
  fullName: string,
  period: '7d' | '30d' | '90d'
): Promise<void> {
  const dbPeriod = periodToDbEnum[period]

  let commitData: Awaited<ReturnType<typeof fetchCommitFrequency>>
  let prData: Awaited<ReturnType<typeof fetchPrStats>>
  let contributorData: Awaited<ReturnType<typeof fetchContributors>>

  try {
    ;[commitData, prData, contributorData] = await Promise.all([
      fetchCommitFrequency(fullName, period),
      fetchPrStats(fullName, period),
      fetchContributors(fullName, period),
    ])
  } catch (err) {
    console.error(`[sync] Failed to fetch metrics for ${fullName}:`, err)
    throw err
  }

  const commitPayload: CommitFrequencyPayload = {
    weeks: commitData.map((d) => ({ week: d.date, count: d.count })),
    total_days: period === '7d' ? 7 : period === '30d' ? 30 : 90,
  }

  const prPayload: PrStatsPayload = {
    opened: prData.open + prData.closed + prData.merged,
    merged: prData.merged,
    closed: prData.closed,
    avg_merge_time_hours: prData.avgMergeTimeHours,
    total_days: period === '7d' ? 7 : period === '30d' ? 30 : 90,
  }

  const contributorPayload: ContributorPayload = {
    contributors: contributorData.map((c) => ({
      login: c.login,
      commits: c.totalCommits,
      additions: c.additions,
      deletions: c.deletions,
    })),
    total_days: period === '7d' ? 7 : period === '30d' ? 30 : 90,
  }

  await Promise.all([
    upsertMetric(repoId, MetricType.COMMIT_FREQUENCY, dbPeriod, commitPayload),
    upsertMetric(repoId, MetricType.PR_STATS, dbPeriod, prPayload),
    upsertMetric(repoId, MetricType.CONTRIBUTOR_ACTIVITY, dbPeriod, contributorPayload),
  ])

  await prisma.repository.update({
    where: { id: repoId },
    data: { last_synced_at: new Date() },
  })
}

export async function syncAllUserRepos(userId: string): Promise<void> {
  const repos = await prisma.repository.findMany({
    where: { owner_id: userId },
    select: { id: true, full_name: true },
  })

  const results = await Promise.allSettled(
    repos.map((r) => syncRepoMetrics(r.id, r.full_name, '30d'))
  )

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const repo = repos[i]
    if (result.status === 'fulfilled') {
      console.log(`[sync] ${repo.full_name} succeeded`)
    } else {
      console.error(
        `[sync] ${repo.full_name} failed:`,
        result.reason instanceof McpError
          ? `${result.reason.code}: ${result.reason.message}`
          : result.reason
      )
    }
  }
}
