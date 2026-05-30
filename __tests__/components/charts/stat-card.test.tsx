// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from '@/components/charts/stat-card'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Commits" value={42} isLoading={false} />)
    expect(screen.getByText('Commits')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('shows skeleton when isLoading=true', () => {
    const { container } = render(
      <StatCard label="Commits" value={0} isLoading={true} />
    )
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('Commits')).not.toBeInTheDocument()
  })

  it('shows positive delta in green', () => {
    render(<StatCard label="PRs" value={5} delta={12} isLoading={false} />)
    const delta = screen.getByText('12%').parentElement
    expect(delta).toHaveClass('text-green-600')
  })

  it('shows negative delta in red', () => {
    render(<StatCard label="PRs" value={3} delta={-8} isLoading={false} />)
    const delta = screen.getByText('8%').parentElement
    expect(delta).toHaveClass('text-red-600')
  })

  it('does not render delta when not provided', () => {
    render(<StatCard label="X" value={1} isLoading={false} />)
    expect(screen.queryByText('%')).not.toBeInTheDocument()
  })
})
