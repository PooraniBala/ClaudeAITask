// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from '@/components/ui/card'

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Hello card</Card>)
    expect(screen.getByText('Hello card')).toBeInTheDocument()
  })

  it('applies base classes', () => {
    const { container } = render(<Card>content</Card>)
    expect(container.firstChild).toHaveClass('rounded-lg', 'bg-white')
  })

  it('merges custom className', () => {
    const { container } = render(<Card className="p-2">x</Card>)
    expect(container.firstChild).toHaveClass('p-2')
  })

  it('renders multiple children', () => {
    render(
      <Card>
        <span>a</span>
        <span>b</span>
      </Card>
    )
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
  })
})
