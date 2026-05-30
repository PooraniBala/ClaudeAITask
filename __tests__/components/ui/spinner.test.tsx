// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Spinner } from '@/components/ui/spinner'

describe('Spinner', () => {
  it('renders with default md size', () => {
    render(<Spinner />)
    const el = screen.getByRole('status')
    expect(el).toBeInTheDocument()
    expect(el).toHaveClass('h-6', 'w-6')
  })

  it('renders sm size', () => {
    render(<Spinner size="sm" />)
    expect(screen.getByRole('status')).toHaveClass('h-4', 'w-4')
  })

  it('renders lg size', () => {
    render(<Spinner size="lg" />)
    expect(screen.getByRole('status')).toHaveClass('h-8', 'w-8')
  })

  it('has accessible label', () => {
    render(<Spinner />)
    expect(screen.getByLabelText('Loading')).toBeInTheDocument()
  })
})
