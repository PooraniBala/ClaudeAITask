// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ActivityFeed } from '@/components/dashboard/activity-feed'

vi.mock('swr', () => ({
  default: vi.fn(),
}))

import useSWR from 'swr'

describe('ActivityFeed', () => {
  it('shows loading skeleton when isLoading=true (parent)', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    render(<ActivityFeed repoId="r1" isLoading={true} />)
    const { container } = render(<ActivityFeed repoId="r1" isLoading={true} />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows error message when error prop is provided', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    render(
      <ActivityFeed repoId="r1" isLoading={false} error="Failed to load" />
    )
    expect(screen.getByText('Failed to load')).toBeInTheDocument()
  })

  it('shows empty state when metrics return no contributor data', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: { data: [], error: null },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    render(<ActivityFeed repoId="r1" isLoading={false} />)
    expect(screen.getByText('No contributor data yet')).toBeInTheDocument()
  })

  it('clicking retry button calls mutate', async () => {
    const user = userEvent.setup()
    const mutate = vi.fn()
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: false,
      mutate,
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    render(<ActivityFeed repoId="r1" isLoading={false} error="Failed" />)
    await user.click(screen.getByRole('button', { name: /retry/i }))
    expect(mutate).toHaveBeenCalled()
  })

  it('renders contributor rows from CONTRIBUTOR_ACTIVITY metrics', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: {
        data: [
          {
            id: 'm1',
            repoId: 'r1',
            type: 'CONTRIBUTOR_ACTIVITY',
            period: 'THIRTY_DAYS',
            payload: {
              contributors: [
                { login: 'alice', commits: 12, additions: 300, deletions: 50 },
                { login: 'bob', commits: 5, additions: 0, deletions: 0 },
              ],
              total_days: 30,
            },
            recordedAt: '2026-05-01T00:00:00Z',
          },
        ],
        error: null,
      },
      error: undefined,
      isLoading: false,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    render(<ActivityFeed repoId="r1" isLoading={false} />)
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText(/12 commits/)).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
  })
})
