// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LoginPage from '@/app/(auth)/login/page'

const mockPush = vi.fn()
const mockSearchParams = vi.fn(() => new URLSearchParams())

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => mockSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows "Invalid email or password" on 401 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Invalid credentials' }),
    })
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Password'), 'wrongpass')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password'
    )
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('disables the submit button while the request is in-flight', async () => {
    let resolve: (v: unknown) => void
    global.fetch = vi.fn().mockReturnValue(new Promise((r) => (resolve = r)))
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Password'), 'pass1234')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled()
    resolve!({ ok: true, json: () => Promise.resolve({ data: null, error: null }) })
  })

  it('redirects to / on successful login', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: 'u1', email: 'test@test.com' }, error: null }),
    })
    const user = userEvent.setup()
    render(<LoginPage />)
    await user.type(screen.getByLabelText('Email'), 'test@test.com')
    await user.type(screen.getByLabelText('Password'), 'pass1234')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/'))
  })

  it('shows success banner when registered=true query param is present', () => {
    mockSearchParams.mockReturnValueOnce(new URLSearchParams('registered=true'))
    render(<LoginPage />)
    expect(screen.getByText(/account created successfully/i)).toBeInTheDocument()
  })
})
