// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RepoSelector } from '@/components/dashboard/repo-selector'
import type { RepoInfo } from '@/lib/types'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

const mockMutate = vi.fn()
vi.mock('swr', () => ({
  useSWRConfig: () => ({ mutate: mockMutate }),
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const REPOS: RepoInfo[] = [
  {
    id: 'r1',
    githubId: 1,
    name: 'frontend',
    fullName: 'alice/frontend',
    url: 'https://github.com/alice/frontend',
    isPrivate: false,
    lastSyncedAt: null,
    createdAt: '2026-01-01',
  },
  {
    id: 'r2',
    githubId: 2,
    name: 'backend',
    fullName: 'alice/backend',
    url: 'https://github.com/alice/backend',
    isPrivate: true,
    lastSyncedAt: null,
    createdAt: '2026-01-01',
  },
]

describe('RepoSelector', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockMutate.mockReset()
  })

  it('shows spinner when isLoading=true', () => {
    render(
      <RepoSelector repos={[]} selectedId="" onSelect={vi.fn()} isLoading={true} />
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows empty state when repos=[]', () => {
    render(
      <RepoSelector repos={[]} selectedId="" onSelect={vi.fn()} isLoading={false} />
    )
    expect(screen.getByText(/no repos connected/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /connect one/i })).toBeInTheDocument()
  })

  it('renders repo names as buttons', () => {
    render(
      <RepoSelector
        repos={REPOS}
        selectedId="r1"
        onSelect={vi.fn()}
        isLoading={false}
      />
    )
    expect(screen.getByText('alice/frontend')).toBeInTheDocument()
    expect(screen.getByText('alice/backend')).toBeInTheDocument()
  })

  it('renders a refresh button for each repo', () => {
    render(
      <RepoSelector
        repos={REPOS}
        selectedId="r1"
        onSelect={vi.fn()}
        isLoading={false}
      />
    )
    expect(screen.getByRole('button', { name: 'Refresh alice/frontend' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refresh alice/backend' })).toBeInTheDocument()
  })

  it('calls onSelect when a repo row is clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <RepoSelector
        repos={REPOS}
        selectedId="r1"
        onSelect={onSelect}
        isLoading={false}
      />
    )
    await user.click(screen.getByText('alice/backend'))
    expect(onSelect).toHaveBeenCalledWith('r2')
  })

  it('clicking Refresh calls sync endpoint and invalidates SWR cache on success', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: { synced: true } }) })

    render(
      <RepoSelector
        repos={REPOS}
        selectedId="r1"
        onSelect={vi.fn()}
        isLoading={false}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Refresh alice/frontend' }))

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/repos/r1/sync', { method: 'POST' })
      expect(mockMutate).toHaveBeenCalled()
    })
  })

  it('shows rate-limit error when sync returns 429', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ meta: { retryAfter: 120 } }),
    })

    render(
      <RepoSelector
        repos={REPOS}
        selectedId="r1"
        onSelect={vi.fn()}
        isLoading={false}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Refresh alice/frontend' }))

    await waitFor(() => {
      expect(screen.getByText(/rate limited/i)).toBeInTheDocument()
    })
  })

  it('shows sync failed error when fetch throws (network error)', async () => {
    const user = userEvent.setup()
    mockFetch.mockRejectedValueOnce(new TypeError('Network error'))

    render(
      <RepoSelector
        repos={REPOS}
        selectedId="r1"
        onSelect={vi.fn()}
        isLoading={false}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Refresh alice/frontend' }))

    await waitFor(() => {
      expect(screen.getByText(/sync failed/i)).toBeInTheDocument()
    })
  })

  it('shows generic sync failed error on non-429 failure', async () => {
    const user = userEvent.setup()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal error' }),
    })

    render(
      <RepoSelector
        repos={REPOS}
        selectedId="r1"
        onSelect={vi.fn()}
        isLoading={false}
      />
    )

    await user.click(screen.getByRole('button', { name: 'Refresh alice/frontend' }))

    await waitFor(() => {
      expect(screen.getByText(/sync failed/i)).toBeInTheDocument()
    })
  })
})
