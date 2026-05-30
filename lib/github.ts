export class McpError extends Error {
  constructor(
    message: string,
    public readonly code: 'RATE_LIMITED' | 'NOT_FOUND' | 'UNREACHABLE',
    public readonly retryAfter?: number
  ) {
    super(message)
    this.name = 'McpError'
  }
}

// Kept for test backward-compat — callers should use McpError going forward
export class GitHubRateLimitError extends Error {
  retryAfter: number
  constructor(retryAfter: number) {
    super('GitHub rate limit exceeded')
    this.name = 'GitHubRateLimitError'
    this.retryAfter = retryAfter
  }
}

export type RepoMetadata = {
  githubId: number
  name: string
  fullName: string
  url: string
  isPrivate: boolean
  description: string | null
  stargazersCount: number
  defaultBranch: string
}

export type CommitFrequencyData = {
  date: string
  count: number
  sha: string[]
}

export type PrStatsData = {
  open: number
  closed: number
  merged: number
  avgMergeTimeHours: number
}

export type ContributorData = {
  login: string
  avatarUrl: string
  totalCommits: number
  additions: number
  deletions: number
}

function getToken(): string | undefined {
  return process.env.GITHUB_TOKEN
}

function periodStartDate(period: '7d' | '30d' | '90d'): Date {
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
}

async function ghFetch(path: string): Promise<Response> {
  const token = getToken()
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`https://api.github.com${path}`, { headers })
  } catch {
    throw new McpError('GitHub MCP unreachable', 'UNREACHABLE')
  }

  if (res.status === 404) {
    throw new McpError('Repository not found or access denied', 'NOT_FOUND')
  }
  if (res.status === 429 || (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0')) {
    const retryAfter = Number(res.headers.get('Retry-After') ?? res.headers.get('X-RateLimit-Reset') ?? 60)
    throw new McpError(
      `GitHub rate limit exceeded, retry after ${retryAfter}`,
      'RATE_LIMITED',
      retryAfter
    )
  }

  return res
}

// MCP tool: get_repository
export async function fetchRepoMetadata(fullName: string): Promise<RepoMetadata> {
  const res = await ghFetch(`/repos/${fullName}`)
  if (!res.ok) throw new McpError('Repository not found or access denied', 'NOT_FOUND')

  const data = (await res.json()) as {
    id: number
    name: string
    full_name: string
    html_url: string
    private: boolean
    description: string | null
    stargazers_count: number
    default_branch: string
  }

  return {
    githubId: data.id,
    name: data.name,
    fullName: data.full_name,
    url: data.html_url,
    isPrivate: data.private,
    description: data.description,
    stargazersCount: data.stargazers_count,
    defaultBranch: data.default_branch,
  }
}

// MCP tool: list_commits
export async function fetchCommitFrequency(
  fullName: string,
  period: '7d' | '30d' | '90d'
): Promise<CommitFrequencyData[]> {
  const since = periodStartDate(period).toISOString()
  const res = await ghFetch(`/repos/${fullName}/commits?since=${since}&per_page=100`)
  if (!res.ok) throw new McpError('Repository not found or access denied', 'NOT_FOUND')

  const commits = (await res.json()) as Array<{
    sha: string
    commit: { author: { date: string } | null }
  }>

  const byDate = new Map<string, string[]>()
  for (const c of commits) {
    const date = (c.commit.author?.date ?? '').slice(0, 10)
    if (!date) continue
    const existing = byDate.get(date) ?? []
    existing.push(c.sha)
    byDate.set(date, existing)
  }

  return Array.from(byDate.entries())
    .map(([date, sha]) => ({ date, count: sha.length, sha }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// MCP tool: list_pull_requests
export async function fetchPrStats(
  fullName: string,
  period: '7d' | '30d' | '90d'
): Promise<PrStatsData> {
  const since = periodStartDate(period)

  const [openRes, closedRes] = await Promise.all([
    ghFetch(`/repos/${fullName}/pulls?state=open&per_page=100`),
    ghFetch(`/repos/${fullName}/pulls?state=closed&sort=updated&direction=desc&per_page=100`),
  ])

  if (!openRes.ok) throw new McpError('Repository not found or access denied', 'NOT_FOUND')
  if (!closedRes.ok) throw new McpError('Repository not found or access denied', 'NOT_FOUND')

  const openPrs = (await openRes.json()) as Array<{ updated_at: string }>
  const closedPrs = (await closedRes.json()) as Array<{
    updated_at: string
    merged_at: string | null
    created_at: string
  }>

  const inPeriodOpen = openPrs.filter((pr) => new Date(pr.updated_at) >= since)
  const inPeriodClosed = closedPrs.filter((pr) => new Date(pr.updated_at) >= since)

  const mergedPrs = inPeriodClosed.filter((pr) => pr.merged_at !== null)

  let avgMergeTimeHours = 0
  if (mergedPrs.length > 0) {
    const totalMs = mergedPrs.reduce((sum, pr) => {
      return sum + (new Date(pr.merged_at!).getTime() - new Date(pr.created_at).getTime())
    }, 0)
    avgMergeTimeHours = totalMs / mergedPrs.length / (1000 * 60 * 60)
  }

  return {
    open: inPeriodOpen.length,
    closed: inPeriodClosed.filter((pr) => pr.merged_at === null).length,
    merged: mergedPrs.length,
    avgMergeTimeHours: Math.round(avgMergeTimeHours * 10) / 10,
  }
}

// MCP tool: list_commits (grouped by author)
export async function fetchContributors(
  fullName: string,
  period: '7d' | '30d' | '90d'
): Promise<ContributorData[]> {
  const since = periodStartDate(period).toISOString()
  const res = await ghFetch(`/repos/${fullName}/commits?since=${since}&per_page=100`)
  if (!res.ok) throw new McpError('Repository not found or access denied', 'NOT_FOUND')

  const commits = (await res.json()) as Array<{
    sha: string
    author: { login: string; avatar_url: string } | null
    commit: { author: { name: string } | null }
  }>

  const byAuthor = new Map<string, { avatarUrl: string; totalCommits: number }>()
  for (const c of commits) {
    const login = c.author?.login ?? c.commit.author?.name ?? 'unknown'
    const avatarUrl = c.author?.avatar_url ?? ''
    const existing = byAuthor.get(login)
    if (existing) {
      existing.totalCommits += 1
    } else {
      byAuthor.set(login, { avatarUrl, totalCommits: 1 })
    }
  }

  // Fetch contributor stats for additions/deletions; gracefully degrade to 0 on 202
  let statsMap = new Map<string, { additions: number; deletions: number }>()
  try {
    const statsRes = await ghFetch(`/repos/${fullName}/stats/contributors`)
    if (statsRes.status === 200) {
      const statsData = (await statsRes.json()) as Array<{
        author: { login: string } | null
        weeks: Array<{ w: number; a: number; d: number }>
      }>
      const sinceMs = new Date(since).getTime()
      for (const s of statsData) {
        if (!s.author) continue
        const totals = s.weeks
          .filter((w) => w.w * 1000 >= sinceMs)
          .reduce((acc, w) => ({ additions: acc.additions + w.a, deletions: acc.deletions + w.d }), { additions: 0, deletions: 0 })
        statsMap.set(s.author.login, totals)
      }
    }
  } catch {
    // stats endpoint failure is non-fatal — additions/deletions default to 0
  }

  return Array.from(byAuthor.entries())
    .map(([login, data]) => ({
      login,
      avatarUrl: data.avatarUrl,
      totalCommits: data.totalCommits,
      additions: statsMap.get(login)?.additions ?? 0,
      deletions: statsMap.get(login)?.deletions ?? 0,
    }))
    .sort((a, b) => b.totalCommits - a.totalCommits)
    .slice(0, 10)
}
