// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterPage from '@/app/(auth)/register/page'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

describe('RegisterPage', () => {
  beforeEach(() => vi.clearAllMocks())

  async function fillForm(
    user: ReturnType<typeof userEvent.setup>,
    overrides: { email?: string; password?: string; confirm?: string } = {}
  ): Promise<void> {
    await user.type(
      screen.getByLabelText('Email'),
      overrides.email ?? 'new@test.com'
    )
    await user.type(
      screen.getByLabelText('Password'),
      overrides.password ?? 'password123'
    )
    await user.type(
      screen.getByLabelText('Confirm password'),
      overrides.confirm ?? overrides.password ?? 'password123'
    )
  }

  it('shows field error for invalid email', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.type(screen.getByLabelText('Password'), 'password123')
    await user.type(screen.getByLabelText('Confirm password'), 'password123')
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Invalid email address')).toBeInTheDocument()
  })

  it('shows field error when passwords do not match', async () => {
    const user = userEvent.setup()
    render(<RegisterPage />)
    await fillForm(user, { password: 'password123', confirm: 'different456' })
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
  })

  it('shows "Email already in use" on 409 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'Already exists' }),
    })
    const user = userEvent.setup()
    render(<RegisterPage />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Email already in use')).toBeInTheDocument()
  })

  it('redirects to /login?registered=true on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({ data: { id: 'u1', email: 'new@test.com' }, error: null }),
    })
    const user = userEvent.setup()
    render(<RegisterPage />)
    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('/login?registered=true')
    )
  })
})
