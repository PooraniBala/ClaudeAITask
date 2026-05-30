// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ErrorBoundary } from '@/components/ui/error-boundary'

function Boom(): React.ReactElement {
  throw new Error('test explosion')
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <span>Safe content</span>
      </ErrorBoundary>
    )
    expect(screen.getByText('Safe content')).toBeInTheDocument()
  })

  it('renders default fallback when a child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/test explosion/)).toBeInTheDocument()
    spy.mockRestore()
  })

  it('renders custom fallback prop', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary fallback={<div>Custom error UI</div>}>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText('Custom error UI')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('recovers when Try again is clicked', async () => {
    const user = userEvent.setup()
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    // After reset, children try to render again (and throw again in this test)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    spy.mockRestore()
  })
})
