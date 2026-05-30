'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/utils'
import { PageShell } from '@/components/layout/page-shell'
import { StatCard } from '@/components/charts/stat-card'
import { MetricsChart } from '@/components/charts/metrics-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { RepoSelector } from '@/components/dashboard/repo-selector'
import { TimeRangeFilter } from '@/components/dashboard/time-range-filter'
import { ErrorBoundary } from '@/components/ui/error-boundary'
import type {
  ApiResponse,
  DashboardData,
  MetricInfo,
  CommitFrequencyPayload,
  PrStatsPayload,
  ContributorPayload,
  TimeRange,
} from '@/lib/types'

function pickPayloads<T>(
  metrics: MetricInfo[],
  type: string
): T[] {
  return metrics.filter((m) => m.type === type).map((m) => m.payload as T)
}

export default function DashboardPage(): React.ReactElement {
  const [selectedRepoId, setSelectedRepoId] = useState('')
  const [period, setPeriod] = useState<TimeRange>('30d')

  const { data: dash, isLoading: dashLoading } = useSWR<
    ApiResponse<DashboardData>
  >('/api/dashboard', fetcher)

  const { data: metricsRes, isLoading: metricsLoading } = useSWR<
    ApiResponse<MetricInfo[]>
  >(
    selectedRepoId
      ? `/api/metrics/${selectedRepoId}?period=${period}`
      : null,
    fetcher
  )

  const repos = dash?.data?.repos ?? []
  const metrics = metricsRes?.data ?? []

  const commitData = pickPayloads<CommitFrequencyPayload>(
    metrics,
    'COMMIT_FREQUENCY'
  )
  const prData = pickPayloads<PrStatsPayload>(metrics, 'PR_STATS')
  const contribData = pickPayloads<ContributorPayload>(
    metrics,
    'CONTRIBUTOR_ACTIVITY'
  )

  const repoInfos = repos.map((r) => ({
    id: r.id,
    githubId: 0,
    name: r.fullName.split('/')[1] ?? r.fullName,
    fullName: r.fullName,
    url: '',
    isPrivate: false,
    lastSyncedAt: null,
    createdAt: '',
  }))

  return (
    <PageShell
      title="Overview"
      description="Engineering health across all connected repositories"
    >
      <ErrorBoundary>
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Commits"
              value={dash?.data?.totalCommits ?? 0}
              isLoading={dashLoading}
            />
            <StatCard
              label="Open PRs"
              value={dash?.data?.openPrs ?? 0}
              isLoading={dashLoading}
            />
            <StatCard
              label="Top Contributor"
              value={dash?.data?.topContributor ?? '—'}
              isLoading={dashLoading}
            />
            <StatCard
              label="Repos"
              value={dash?.data?.repoCount ?? 0}
              isLoading={dashLoading}
            />
          </div>

          {/* Repo + time range controls */}
          <div className="flex flex-wrap items-center gap-3">
            <RepoSelector
              repos={repoInfos}
              selectedId={selectedRepoId}
              onSelect={setSelectedRepoId}
              isLoading={dashLoading}
            />
            <TimeRangeFilter value={period} onChange={setPeriod} />
          </div>

          {/* Charts */}
          {selectedRepoId && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div>
                <h2 className="mb-2 text-sm font-semibold text-gray-700">
                  Commit Frequency
                </h2>
                <MetricsChart
                  data={commitData}
                  type="COMMIT_FREQUENCY"
                  isLoading={metricsLoading}
                />
              </div>
              <div>
                <h2 className="mb-2 text-sm font-semibold text-gray-700">
                  PR Stats
                </h2>
                <MetricsChart
                  data={prData}
                  type="PR_STATS"
                  isLoading={metricsLoading}
                />
              </div>
              <div className="lg:col-span-2">
                <h2 className="mb-2 text-sm font-semibold text-gray-700">
                  Contributor Activity
                </h2>
                <MetricsChart
                  data={contribData}
                  type="CONTRIBUTOR_ACTIVITY"
                  isLoading={metricsLoading}
                />
              </div>
            </div>
          )}

          {/* Activity feed */}
          {selectedRepoId && (
            <ActivityFeed repoId={selectedRepoId} isLoading={metricsLoading} />
          )}
        </div>
      </ErrorBoundary>
    </PageShell>
  )
}
