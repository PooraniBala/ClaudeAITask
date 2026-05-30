// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders children', () => {
    render(<Button variant="primary" size="md">Click me</Button>)
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
  })

  it('shows spinner and disables when isLoading=true', () => {
    render(<Button variant="primary" size="md" isLoading>Loading</Button>)
    const btn = screen.getByRole('button')
    expect(btn).toBeDisabled()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('is disabled when disabled=true', () => {
    render(<Button variant="primary" size="md" disabled>Disabled</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const fn = vi.fn()
    render(<Button variant="primary" size="md" onClick={fn}>Go</Button>)
    await user.click(screen.getByRole('button'))
    expect(fn).toHaveBeenCalledOnce()
  })

  it('does not call onClick when disabled', async () => {
    const user = userEvent.setup()
    const fn = vi.fn()
    render(<Button variant="primary" size="md" disabled onClick={fn}>Go</Button>)
    await user.click(screen.getByRole('button'))
    expect(fn).not.toHaveBeenCalled()
  })
})
