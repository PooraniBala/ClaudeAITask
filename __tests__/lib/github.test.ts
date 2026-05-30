import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  fetchRepoMetadata,
  fetchCommitFrequency,
  fetchPrStats,
  fetchContributors,
  McpError,
  GitHubRateLimitError,
} from '@/lib/github'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (k: string) => headers[k] ?? null,
    },
    json: () => Promise.resolve(body),
  } as unknown as Response
}

const FAKE_REPO_API = {
  id: 12345,
  name: 'my-repo',
  full_name: 'owner/my-repo',
  html_url: 'https://github.com/owner/my-repo',
  private: false,
  description: 'A test repo',
  stargazers_count: 42,
  default_branch: 'main',
}

beforeEach(() => {
  mockFetch.mockReset()
  vi.stubEnv('GITHUB_TOKEN', 'test-token')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('fetchRepoMetadata', () => {
  it('returns correctly mapped RepoMetadata', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(FAKE_REPO_API))

    const result = await fetchRepoMetadata('owner/my-repo')

    expect(result).toEqual({
      githubId: 12345,
      name: 'my-repo',
      fullName: 'owner/my-repo',
      url: 'https://github.com/owner/my-repo',
      isPrivate: false,
      description: 'A test repo',
      stargazersCount: 42,
      defaultBranch: 'main',
    })
  })

  it('throws McpError NOT_FOUND on 404', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 404))

    await expect(fetchRepoMetadata('owner/missing')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'NOT_FOUND'
    )
  })

  it('throws McpError RATE_LIMITED on 429', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({}, 429, { 'Retry-After': '30' })
    )

    await expect(fetchRepoMetadata('owner/repo')).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof McpError && e.code === 'RATE_LIMITED' && e.retryAfter === 30
    )
  })

  it('throws McpError RATE_LIMITED on 403 rate limit', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({}, 403, { 'X-RateLimit-Remaining': '0', 'X-RateLimit-Reset': '60' })
    )

    await expect(fetchRepoMetadata('owner/repo')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'RATE_LIMITED'
    )
  })
})

describe('fetchCommitFrequency', () => {
  it('groups commits by date and sorts ascending', async () => {
    const commits = [
      { sha: 'aaa', commit: { author: { date: '2024-01-03T10:00:00Z' } } },
      { sha: 'bbb', commit: { author: { date: '2024-01-01T08:00:00Z' } } },
      { sha: 'ccc', commit: { author: { date: '2024-01-01T12:00:00Z' } } },
      { sha: 'ddd', commit: { author: { date: '2024-01-02T09:00:00Z' } } },
    ]
    mockFetch.mockResolvedValueOnce(makeResponse(commits))

    const result = await fetchCommitFrequency('owner/repo', '30d')

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ date: '2024-01-01', count: 2, sha: ['bbb', 'ccc'] })
    expect(result[1]).toEqual({ date: '2024-01-02', count: 1, sha: ['ddd'] })
    expect(result[2]).toEqual({ date: '2024-01-03', count: 1, sha: ['aaa'] })
  })

  it('returns empty array when no commits', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([]))

    const result = await fetchCommitFrequency('owner/repo', '7d')

    expect(result).toEqual([])
  })
})

describe('fetchPrStats', () => {
  it('calculates avgMergeTimeHours correctly', async () => {
    const openPrs = [
      { updated_at: new Date().toISOString() },
      { updated_at: new Date().toISOString() },
    ]
    // merged PR: 4 hours merge time
    const mergedAt = new Date()
    const createdAt = new Date(mergedAt.getTime() - 4 * 60 * 60 * 1000)
    const closedPrs = [
      {
        updated_at: new Date().toISOString(),
        merged_at: mergedAt.toISOString(),
        created_at: createdAt.toISOString(),
      },
      {
        updated_at: new Date().toISOString(),
        merged_at: null,
        created_at: new Date().toISOString(),
      },
    ]

    mockFetch
      .mockResolvedValueOnce(makeResponse(openPrs))
      .mockResolvedValueOnce(makeResponse(closedPrs))

    const result = await fetchPrStats('owner/repo', '30d')

    expect(result.open).toBe(2)
    expect(result.merged).toBe(1)
    expect(result.closed).toBe(1)
    expect(result.avgMergeTimeHours).toBe(4)
  })

  it('returns zero avgMergeTimeHours when no merged PRs', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse([]))
      .mockResolvedValueOnce(makeResponse([]))

    const result = await fetchPrStats('owner/repo', '7d')

    expect(result.avgMergeTimeHours).toBe(0)
  })
})

describe('fetchContributors', () => {
  it('returns top 10 sorted by totalCommits descending', async () => {
    const commits = Array.from({ length: 12 }, (_, i) => ({
      sha: `sha${i}`,
      author: { login: `user${i}`, avatar_url: `https://avatars.github.com/u/${i}` },
      commit: { author: { name: `user${i}` } },
    }))
    // Make user0 have 3 commits, user1 have 2 commits, rest have 1
    commits.push(
      { sha: 'sha-u0b', author: { login: 'user0', avatar_url: 'https://avatars.github.com/u/0' }, commit: { author: { name: 'user0' } } },
      { sha: 'sha-u0c', author: { login: 'user0', avatar_url: 'https://avatars.github.com/u/0' }, commit: { author: { name: 'user0' } } },
      { sha: 'sha-u1b', author: { login: 'user1', avatar_url: 'https://avatars.github.com/u/1' }, commit: { author: { name: 'user1' } } }
    )

    // Stats endpoint returns 202 (computing) — should degrade gracefully
    mockFetch
      .mockResolvedValueOnce(makeResponse(commits))
      .mockResolvedValueOnce(makeResponse(null, 202))

    const result = await fetchContributors('owner/repo', '30d')

    expect(result.length).toBeLessThanOrEqual(10)
    expect(result[0].login).toBe('user0')
    expect(result[0].totalCommits).toBe(3)
    expect(result[1].login).toBe('user1')
    expect(result[1].totalCommits).toBe(2)
  })

  it('uses additions/deletions from stats endpoint when available', async () => {
    const now = Math.floor(Date.now() / 1000)
    const commits = [
      { sha: 'abc', author: { login: 'devA', avatar_url: 'https://x.com' }, commit: { author: { name: 'devA' } } },
    ]
    const statsData = [
      {
        author: { login: 'devA' },
        weeks: [{ w: now - 100, a: 50, d: 10, c: 1 }],
      },
    ]

    mockFetch
      .mockResolvedValueOnce(makeResponse(commits))
      .mockResolvedValueOnce(makeResponse(statsData))

    const result = await fetchContributors('owner/repo', '30d')

    expect(result[0].login).toBe('devA')
    expect(result[0].additions).toBe(50)
    expect(result[0].deletions).toBe(10)
  })
})

describe('GitHubRateLimitError (backward-compat)', () => {
  it('sets retryAfter and name correctly', () => {
    const err = new GitHubRateLimitError(90)
    expect(err.retryAfter).toBe(90)
    expect(err.name).toBe('GitHubRateLimitError')
    expect(err.message).toBe('GitHub rate limit exceeded')
    expect(err).toBeInstanceOf(Error)
  })
})

describe('McpError UNREACHABLE — network failure', () => {
  it('fetchRepoMetadata throws UNREACHABLE when fetch rejects', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network error'))

    await expect(fetchRepoMetadata('owner/repo')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'UNREACHABLE'
    )
  })

  it('fetchCommitFrequency throws UNREACHABLE on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network error'))

    await expect(fetchCommitFrequency('owner/repo', '30d')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'UNREACHABLE'
    )
  })

  it('fetchPrStats throws UNREACHABLE on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network error'))

    await expect(fetchPrStats('owner/repo', '7d')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'UNREACHABLE'
    )
  })

  it('fetchContributors throws UNREACHABLE on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('Network error'))

    await expect(fetchContributors('owner/repo', '90d')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'UNREACHABLE'
    )
  })
})

describe('McpError RATE_LIMITED — 403 with rate limit headers', () => {
  it('fetchCommitFrequency throws RATE_LIMITED on 429', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429, { 'Retry-After': '45' }))

    await expect(fetchCommitFrequency('owner/repo', '30d')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'RATE_LIMITED' && e.retryAfter === 45
    )
  })

  it('fetchPrStats throws RATE_LIMITED on first parallel request returning 429', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429, { 'Retry-After': '60' }))
    mockFetch.mockResolvedValueOnce(makeResponse([], 200))

    await expect(fetchPrStats('owner/repo', '30d')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'RATE_LIMITED'
    )
  })

  it('fetchContributors throws RATE_LIMITED on 429', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429, { 'Retry-After': '30' }))

    await expect(fetchContributors('owner/repo', '7d')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'RATE_LIMITED'
    )
  })
})

describe('fetchRepoMetadata — non-OK non-404 response', () => {
  it('throws NOT_FOUND on 403 without rate-limit header', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 403))

    await expect(fetchRepoMetadata('owner/private-repo')).rejects.toSatisfy(
      (e: unknown) => e instanceof McpError && e.code === 'NOT_FOUND'
    )
  })
})

describe('fetchCommitFrequency — period variations', () => {
  it('passes correct since date for 7d period', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([]))
    await fetchCommitFrequency('owner/repo', '7d')

    const url = (mockFetch.mock.calls[0] as [string])[0]
    const sinceParam = new URL(url).searchParams.get('since')
    expect(sinceParam).toBeTruthy()
    const since = new Date(sinceParam!)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    expect(Math.abs(since.getTime() - sevenDaysAgo.getTime())).toBeLessThan(5000)
  })

  it('passes correct since date for 90d period', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse([]))
    await fetchCommitFrequency('owner/repo', '90d')

    const url = (mockFetch.mock.calls[0] as [string])[0]
    const sinceParam = new URL(url).searchParams.get('since')
    const since = new Date(sinceParam!)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    expect(Math.abs(since.getTime() - ninetyDaysAgo.getTime())).toBeLessThan(5000)
  })
})

describe('fetchContributors — edge cases', () => {
  it('uses login from commit.author.name when author field is null', async () => {
    const commits = [
      { sha: 'xyz', author: null, commit: { author: { name: 'ghost-user' } } },
    ]
    mockFetch
      .mockResolvedValueOnce(makeResponse(commits))
      .mockResolvedValueOnce(makeResponse(null, 202))

    const result = await fetchContributors('owner/repo', '30d')
    expect(result[0].login).toBe('ghost-user')
    expect(result[0].avatarUrl).toBe('')
  })

  it('handles stats contributor with null author gracefully', async () => {
    const commits = [
      { sha: 'abc', author: { login: 'user1', avatar_url: 'https://x.com' }, commit: { author: { name: 'user1' } } },
    ]
    const statsData = [
      { author: null, weeks: [{ w: 0, a: 100, d: 50, c: 5 }] },
    ]
    mockFetch
      .mockResolvedValueOnce(makeResponse(commits))
      .mockResolvedValueOnce(makeResponse(statsData))

    const result = await fetchContributors('owner/repo', '30d')
    expect(result[0].login).toBe('user1')
    expect(result[0].additions).toBe(0)
  })
})
