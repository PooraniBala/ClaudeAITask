'use client'

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Spinner } from '@/components/ui/spinner'
import type {
  MetricsChartProps,
  CommitFrequencyPayload,
  PrStatsPayload,
  ContributorPayload,
} from '@/lib/types'

function EmptyState(): React.ReactElement {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-400">
      <svg
        className="h-10 w-10"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zm0 0"
        />
      </svg>
      <p className="text-sm">No data for this period</p>
    </div>
  )
}

export function MetricsChart({
  data,
  type,
  isLoading,
}: MetricsChartProps): React.ReactElement {
  const containerStyle = { width: '100%', height: 260 }

  if (isLoading) {
    return (
      <div
        style={containerStyle}
        className="flex items-center justify-center rounded-lg border border-gray-100 bg-gray-50"
      >
        <Spinner size="lg" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        style={containerStyle}
        className="rounded-lg border border-gray-100 bg-gray-50"
      >
        <EmptyState />
      </div>
    )
  }

  if (type === 'COMMIT_FREQUENCY') {
    const payload = data[0] as CommitFrequencyPayload
    const chartData = payload.weeks ?? []
    return (
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="count"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Commits"
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  if (type === 'PR_STATS') {
    const payload = data[0] as PrStatsPayload
    const chartData = [
      { name: 'Opened', value: payload.opened },
      { name: 'Merged', value: payload.merged },
      { name: 'Closed', value: payload.closed },
    ]
    return (
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#3b82f6" name="PRs" />
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // CONTRIBUTOR_ACTIVITY
  const payload = data[0] as ContributorPayload
  const chartData = (payload.contributors ?? []).map((c) => ({
    login: c.login,
    commits: c.commits,
  }))
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="login" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip />
        <Legend />
        <Bar dataKey="commits" fill="#6366f1" name="Commits" />
      </BarChart>
    </ResponsiveContainer>
  )
}
