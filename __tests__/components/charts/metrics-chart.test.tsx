// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricsChart } from '@/components/charts/metrics-chart'
import type { CommitFrequencyPayload, PrStatsPayload } from '@/lib/types'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="chart-container">{children}</div>
  ),
  LineChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="bar-chart">{children}</div>
  ),
  Line: () => null,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

const commitPayload: CommitFrequencyPayload = {
  weeks: [
    { week: '2026-05-01', count: 5 },
    { week: '2026-05-08', count: 10 },
  ],
  total_days: 30,
}

const prPayload: PrStatsPayload = {
  opened: 4,
  merged: 3,
  closed: 1,
  avg_merge_time_hours: 8,
  total_days: 30,
}

describe('MetricsChart', () => {
  it('shows spinner when isLoading=true', () => {
    render(<MetricsChart data={[]} type="COMMIT_FREQUENCY" isLoading={true} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows empty state when data=[]', () => {
    render(<MetricsChart data={[]} type="COMMIT_FREQUENCY" isLoading={false} />)
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })

  it('renders a line chart for COMMIT_FREQUENCY', () => {
    render(
      <MetricsChart
        data={[commitPayload]}
        type="COMMIT_FREQUENCY"
        isLoading={false}
      />
    )
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders a bar chart for PR_STATS', () => {
    render(
      <MetricsChart data={[prPayload]} type="PR_STATS" isLoading={false} />
    )
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders a bar chart for CONTRIBUTOR_ACTIVITY', () => {
    const contribPayload: import('@/lib/types').ContributorPayload = {
      contributors: [
        { login: 'alice', commits: 10, additions: 50, deletions: 5 },
      ],
      total_days: 30,
    }
    render(
      <MetricsChart
        data={[contribPayload]}
        type="CONTRIBUTOR_ACTIVITY"
        isLoading={false}
      />
    )
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders empty state for CONTRIBUTOR_ACTIVITY with empty data', () => {
    render(
      <MetricsChart data={[]} type="CONTRIBUTOR_ACTIVITY" isLoading={false} />
    )
    expect(screen.getByText('No data for this period')).toBeInTheDocument()
  })
})
