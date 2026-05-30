'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import type {
  ActivityFeedProps,
  ApiResponse,
  MetricInfo,
  ContributorPayload,
} from '@/lib/types'

type ContributorRow = {
  login: string
  commits: number
  additions: number
  deletions: number
}

function extractContributors(metrics: MetricInfo[]): ContributorRow[] {
  for (const m of metrics) {
    if (m.type === 'CONTRIBUTOR_ACTIVITY') {
      const p = m.payload as ContributorPayload
      return p.contributors ?? []
    }
  }
  return []
}

export function ActivityFeed({
  repoId,
  isLoading: parentLoading,
  error: parentError,
}: ActivityFeedProps): React.ReactElement {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse<MetricInfo[]>>(
    repoId ? `/api/metrics/${repoId}?period=30d` : null,
    fetcher
  )

  const loading = parentLoading || isLoading
  const errorMsg = parentError ?? (error as Error | undefined)?.message

  if (loading) {
    return (
      <Card className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Top Contributors</p>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex animate-pulse gap-3">
            <div className="h-8 w-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1">
              <div className="h-3 w-3/4 rounded bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-200" />
            </div>
          </div>
        ))}
      </Card>
    )
  }

  if (errorMsg) {
    return (
      <Card className="space-y-3">
        <p className="text-sm font-medium text-gray-700">Top Contributors</p>
        <p className="text-sm text-red-600">{errorMsg}</p>
        <Button variant="secondary" size="sm" onClick={() => mutate()}>
          Retry
        </Button>
      </Card>
    )
  }

  const contributors = data?.data ? extractContributors(data.data) : []

  if (contributors.length === 0) {
    return (
      <Card>
        <p className="text-sm font-medium text-gray-700">Top Contributors</p>
        <div className="mt-4 flex flex-col items-center gap-2 py-6 text-gray-400">
          <svg
            className="h-8 w-8"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
          <p className="text-sm">No contributor data yet</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <p className="mb-4 text-sm font-medium text-gray-700">Top Contributors</p>
      <ul className="max-h-72 space-y-3 overflow-y-auto">
        {contributors.map((c) => (
          <li key={c.login} className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
              {c.login.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-800">{c.login}</p>
              <p className="text-xs text-gray-400">
                {c.commits} commit{c.commits !== 1 ? 's' : ''}
                {(c.additions > 0 || c.deletions > 0) && (
                  <>
                    {' '}·{' '}
                    <span className="text-green-600">+{c.additions}</span>
                    {' '}
                    <span className="text-red-500">-{c.deletions}</span>
                  </>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
