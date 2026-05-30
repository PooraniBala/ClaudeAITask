// ─── API envelope ────────────────────────────────────────────────────────────

export type ApiResponse<T> = {
  data: T | null
  error: string | null
  meta?: {
    page?: number
    total?: number
    cachedAt?: string
    retryAfter?: number
    synced?: boolean
    from?: string
    to?: string
  }
}

// ─── Backend / shared data types ─────────────────────────────────────────────

export type UserInfo = {
  id: string
  email: string
  createdAt?: string
  hasGithubToken?: boolean
}

export type SessionPayload = {
  userId: string
  email: string
  sessionId: string
}

// Canonical JWT payload type (alias kept alongside SessionPayload for compat)
export type JwtPayload = SessionPayload

export type ApiError = {
  status: number
  message: string
}

export type RepoInfo = {
  id: string
  githubId: number
  name: string
  fullName: string
  url: string
  isPrivate: boolean
  lastSyncedAt: string | null
  createdAt: string
}

export type MetricInfo = {
  id: string
  repoId: string
  type: string
  period: string
  payload: unknown
  recordedAt: string
}

export type DashboardData = {
  totalCommits: number
  openPrs: number
  repoCount: number
  topContributor: string | null
  repos: Array<{
    id: string
    fullName: string
    latestMetrics: MetricInfo[]
  }>
}

// ─── Metric payload shapes ────────────────────────────────────────────────────

export type CommitFrequencyPayload = {
  weeks: Array<{ week: string; count: number }>
  total_days: number
}

export type PrStatsPayload = {
  opened: number
  merged: number
  closed: number
  avg_merge_time_hours: number
  total_days: number
}

export type ContributorPayload = {
  contributors: Array<{
    login: string
    commits: number
    additions: number
    deletions: number
  }>
  total_days: number
}

export type MetricPayload = CommitFrequencyPayload | PrStatsPayload | ContributorPayload

export type MetricType = 'COMMIT_FREQUENCY' | 'PR_STATS' | 'CONTRIBUTOR_ACTIVITY'

// ─── Activity feed ────────────────────────────────────────────────────────────

export type ActivityEvent = {
  id: string
  type: 'commit' | 'pr_opened' | 'pr_merged'
  description: string
  timestamp: string
}

// ─── Layout component props ───────────────────────────────────────────────────

export type PageShellProps = {
  children: React.ReactNode
  title: string
  description?: string
}

export type NavbarProps = {
  user: { email: string }
}

export type SidebarProps = {
  activePath: string
}

// ─── UI primitive props ───────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = {
  variant: ButtonVariant
  size: ButtonSize
  isLoading?: boolean
  disabled?: boolean
  children: React.ReactNode
  onClick?: () => void
  type?: 'button' | 'submit' | 'reset'
  className?: string
}

export type CardProps = {
  children: React.ReactNode
  className?: string
}

export type BadgeVariant = 'success' | 'warning' | 'error' | 'neutral'

export type BadgeProps = {
  label: string
  variant: BadgeVariant
}

export type SpinnerSize = 'sm' | 'md' | 'lg'

export type SpinnerProps = {
  size?: SpinnerSize
}

export type ErrorBoundaryProps = {
  children: React.ReactNode
  fallback?: React.ReactNode
}

// ─── Feature component props ──────────────────────────────────────────────────

export type MetricsChartProps = {
  data: MetricPayload[]
  type: MetricType
  isLoading: boolean
}

export type StatCardProps = {
  label: string
  value: string | number
  delta?: number
  isLoading: boolean
}

export type ActivityFeedProps = {
  repoId: string
  isLoading: boolean
  error?: string
}

export type RepoSelectorProps = {
  repos: RepoInfo[]
  selectedId: string
  onSelect: (id: string) => void
  isLoading: boolean
}

export type TimeRange = '7d' | '30d' | '90d'

export type TimeRangeFilterProps = {
  value: TimeRange
  onChange: (v: TimeRange) => void
}
