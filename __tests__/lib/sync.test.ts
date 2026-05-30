import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { syncRepoMetrics, syncAllUserRepos } from '@/lib/sync'
import { McpError } from '@/lib/github'

vi.mock('@/lib/github', () => ({
  fetchCommitFrequency: vi.fn(),
  fetchPrStats: vi.fn(),
  fetchContributors: vi.fn(),
  McpError: class McpError extends Error {
    code: string
    retryAfter?: number
    constructor(message: string, code: string, retryAfter?: number) {
      super(message)
      this.name = 'McpError'
      this.code = code
      this.retryAfter = retryAfter
    }
  },
}))

const COMMIT_DATA = [
  { date: '2024-01-01', count: 5, sha: ['a', 'b', 'c', 'd', 'e'] },
]
const PR_DATA = { open: 2, closed: 1, merged: 3, avgMergeTimeHours: 4.5 }
const CONTRIBUTOR_DATA = [
  { login: 'alice', avatarUrl: 'https://x.com', totalCommits: 10, additions: 200, deletions: 50 },
]

async function seedUserAndRepo(): Promise<{ userId: string; repoId: string }> {
  const user = await prisma.user.create({
    data: { email: 'sync-tester@example.com', password_hash: 'hash' },
  })
  const repo = await prisma.repository.create({
    data: {
      github_id: 99001,
      name: 'test-repo',
      full_name: 'owner/test-repo',
      url: 'https://github.com/owner/test-repo',
      owner_id: user.id,
    },
  })
  return { userId: user.id, repoId: repo.id }
}

describe('syncRepoMetrics', () => {
  beforeEach(async () => {
    const { fetchCommitFrequency, fetchPrStats, fetchContributors } =
      await import('@/lib/github')
    vi.mocked(fetchCommitFrequency).mockResolvedValue(COMMIT_DATA)
    vi.mocked(fetchPrStats).mockResolvedValue(PR_DATA)
    vi.mocked(fetchContributors).mockResolvedValue(CONTRIBUTOR_DATA)
  })

  it('calls all 3 fetch functions in parallel', async () => {
    const { fetchCommitFrequency, fetchPrStats, fetchContributors } =
      await import('@/lib/github')

    const { repoId } = await seedUserAndRepo()
    await syncRepoMetrics(repoId, 'owner/test-repo', '30d')

    expect(fetchCommitFrequency).toHaveBeenCalledWith('owner/test-repo', '30d')
    expect(fetchPrStats).toHaveBeenCalledWith('owner/test-repo', '30d')
    expect(fetchContributors).toHaveBeenCalledWith('owner/test-repo', '30d')
  })

  it('upserts all 3 Metric records in the DB', async () => {
    const { repoId } = await seedUserAndRepo()
    await syncRepoMetrics(repoId, 'owner/test-repo', '30d')

    const metrics = await prisma.metric.findMany({ where: { repo_id: repoId } })
    const types = metrics.map((m) => m.type).sort()

    expect(types).toEqual(['COMMIT_FREQUENCY', 'CONTRIBUTOR_ACTIVITY', 'PR_STATS'])
  })

  it('updates lastSyncedAt on the Repository row', async () => {
    const before = new Date()
    const { repoId } = await seedUserAndRepo()
    await syncRepoMetrics(repoId, 'owner/test-repo', '30d')

    const repo = await prisma.repository.findUniqueOrThrow({ where: { id: repoId } })
    expect(repo.last_synced_at).not.toBeNull()
    expect(repo.last_synced_at!.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })

  it('re-upserts on second call without duplicating rows', async () => {
    const { repoId } = await seedUserAndRepo()
    await syncRepoMetrics(repoId, 'owner/test-repo', '30d')
    await syncRepoMetrics(repoId, 'owner/test-repo', '30d')

    const count = await prisma.metric.count({ where: { repo_id: repoId } })
    expect(count).toBe(3)
  })

  it('rethrows McpError without swallowing', async () => {
    const { fetchCommitFrequency } = await import('@/lib/github')
    vi.mocked(fetchCommitFrequency).mockRejectedValueOnce(
      new McpError('rate limited', 'RATE_LIMITED', 60)
    )

    const { repoId } = await seedUserAndRepo()

    await expect(syncRepoMetrics(repoId, 'owner/test-repo', '30d')).rejects.toBeInstanceOf(McpError)
  })
})

describe('syncAllUserRepos', () => {
  beforeEach(async () => {
    const { fetchCommitFrequency, fetchPrStats, fetchContributors } =
      await import('@/lib/github')
    vi.mocked(fetchCommitFrequency).mockResolvedValue(COMMIT_DATA)
    vi.mocked(fetchPrStats).mockResolvedValue(PR_DATA)
    vi.mocked(fetchContributors).mockResolvedValue(CONTRIBUTOR_DATA)
  })

  it('continues when one repo fails (Promise.allSettled)', async () => {
    const { fetchCommitFrequency } = await import('@/lib/github')

    const user = await prisma.user.create({
      data: { email: 'allrepos@example.com', password_hash: 'hash' },
    })
    await prisma.repository.createMany({
      data: [
        { github_id: 1001, name: 'repo-a', full_name: 'u/repo-a', url: 'https://github.com/u/repo-a', owner_id: user.id },
        { github_id: 1002, name: 'repo-b', full_name: 'u/repo-b', url: 'https://github.com/u/repo-b', owner_id: user.id },
      ],
    })

    // Fail repo-a deterministically, succeed for repo-b
    vi.mocked(fetchCommitFrequency).mockImplementation((fullName) => {
      if (fullName === 'u/repo-a') return Promise.reject(new McpError('not found', 'NOT_FOUND'))
      return Promise.resolve(COMMIT_DATA)
    })

    // Should not throw
    await expect(syncAllUserRepos(user.id)).resolves.toBeUndefined()

    // Second repo should still have metrics
    const repoB = await prisma.repository.findFirstOrThrow({ where: { full_name: 'u/repo-b' } })
    const count = await prisma.metric.count({ where: { repo_id: repoB.id } })
    expect(count).toBeGreaterThan(0)
  })

  it('syncAllUserRepos with 0 repos completes without error', async () => {
    const user = await prisma.user.create({
      data: { email: 'norepos@example.com', password_hash: 'hash' },
    })
    await expect(syncAllUserRepos(user.id)).resolves.toBeUndefined()
  })

  it('logs non-McpError reason for failed repo', async () => {
    const { fetchCommitFrequency } = await import('@/lib/github')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.mocked(fetchCommitFrequency).mockRejectedValueOnce(new Error('DB timeout'))

    const user = await prisma.user.create({
      data: { email: 'nonmcperror@example.com', password_hash: 'hash' },
    })
    await prisma.repository.create({
      data: {
        github_id: 55001,
        name: 'r',
        full_name: 'u/r',
        url: 'https://github.com/u/r',
        owner_id: user.id,
      },
    })

    await syncAllUserRepos(user.id)

    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})

describe('syncRepoMetrics — period variations', () => {
  beforeEach(async () => {
    const { fetchCommitFrequency, fetchPrStats, fetchContributors } =
      await import('@/lib/github')
    vi.mocked(fetchCommitFrequency).mockResolvedValue(COMMIT_DATA)
    vi.mocked(fetchPrStats).mockResolvedValue(PR_DATA)
    vi.mocked(fetchContributors).mockResolvedValue(CONTRIBUTOR_DATA)
  })

  it('correctly maps 7d period to SEVEN_DAYS in DB', async () => {
    const { repoId } = await seedUserAndRepo()
    await syncRepoMetrics(repoId, 'owner/test-repo', '7d')

    const metrics = await prisma.metric.findMany({ where: { repo_id: repoId } })
    expect(metrics.every((m) => m.period === 'SEVEN_DAYS')).toBe(true)
  })

  it('correctly maps 90d period to NINETY_DAYS in DB', async () => {
    const { repoId } = await seedUserAndRepo()
    await syncRepoMetrics(repoId, 'owner/test-repo', '90d')

    const metrics = await prisma.metric.findMany({ where: { repo_id: repoId } })
    expect(metrics.every((m) => m.period === 'NINETY_DAYS')).toBe(true)
  })

  it('stores correct total_days=7 in payload for 7d period', async () => {
    const { repoId } = await seedUserAndRepo()
    await syncRepoMetrics(repoId, 'owner/test-repo', '7d')

    const commitMetric = await prisma.metric.findFirst({
      where: { repo_id: repoId, type: 'COMMIT_FREQUENCY' },
    })
    expect((commitMetric!.payload as { total_days: number }).total_days).toBe(7)
  })

  it('stores correct total_days=90 in payload for 90d period', async () => {
    const { repoId } = await seedUserAndRepo()
    await syncRepoMetrics(repoId, 'owner/test-repo', '90d')

    const commitMetric = await prisma.metric.findFirst({
      where: { repo_id: repoId, type: 'COMMIT_FREQUENCY' },
    })
    expect((commitMetric!.payload as { total_days: number }).total_days).toBe(90)
  })

  it('still updates lastSyncedAt with empty commit data', async () => {
    const { fetchCommitFrequency } = await import('@/lib/github')
    vi.mocked(fetchCommitFrequency).mockResolvedValue([])

    const before = new Date()
    const { repoId } = await seedUserAndRepo()
    await syncRepoMetrics(repoId, 'owner/test-repo', '30d')

    const repo = await prisma.repository.findUniqueOrThrow({ where: { id: repoId } })
    expect(repo.last_synced_at!.getTime()).toBeGreaterThanOrEqual(before.getTime())
  })
})
