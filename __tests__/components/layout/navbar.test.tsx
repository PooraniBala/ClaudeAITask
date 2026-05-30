// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Navbar } from '@/components/layout/navbar'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('swr', () => ({ default: vi.fn() }))

import useSWR from 'swr'

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn().mockResolvedValue({ ok: true })
  })

  it('renders the DevPulse logo', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: { data: { id: 'u1', email: 'test@test.com' }, error: null },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    render(<Navbar user={{ email: 'test@test.com' }} />)
    expect(screen.getByText('DevPulse')).toBeInTheDocument()
  })

  it('shows user email when authenticated', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: { data: { id: 'u1', email: 'alice@devpulse.dev' }, error: null },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    render(<Navbar user={{ email: 'alice@devpulse.dev' }} />)
    expect(screen.getByText('alice@devpulse.dev')).toBeInTheDocument()
  })

  it('shows Spinner while isLoading is true', () => {
    vi.mocked(useSWR).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    render(<Navbar user={{ email: 'test@test.com' }} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('calls logout API and redirects on logout click', async () => {
    vi.mocked(useSWR).mockReturnValue({
      data: { data: { id: 'u1', email: 'test@test.com' }, error: null },
      isLoading: false,
      error: undefined,
      mutate: vi.fn(),
      isValidating: false,
    } as ReturnType<typeof useSWR>)

    const user = userEvent.setup()
    render(<Navbar user={{ email: 'test@test.com' }} />)
    await user.click(screen.getByRole('button', { name: 'Logout' }))
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/logout', { method: 'DELETE' })
    expect(mockPush).toHaveBeenCalledWith('/login')
  })
})
