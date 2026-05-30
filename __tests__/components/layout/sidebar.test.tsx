// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/layout/sidebar'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

describe('Sidebar', () => {
  it('renders all navigation items', () => {
    render(<Sidebar activePath="/" />)
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Repos')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('highlights the active link', () => {
    render(<Sidebar activePath="/" />)
    const dashLink = screen.getByRole('link', { name: /dashboard/i })
    expect(dashLink).toHaveClass('bg-gray-700')
  })

  it('does not highlight inactive links', () => {
    render(<Sidebar activePath="/" />)
    const reposLink = screen.getByRole('link', { name: /repos/i })
    expect(reposLink).not.toHaveClass('bg-gray-700')
  })

  it('has correct href for each nav item', () => {
    render(<Sidebar activePath="/repos" />)
    expect(screen.getByRole('link', { name: /repos/i })).toHaveAttribute('href', '/repos')
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings')
  })

  it('falls back to usePathname when activePath is empty string', () => {
    // usePathname is mocked to return '/' — Dashboard link should be active
    render(<Sidebar activePath="" />)
    const dashLink = screen.getByRole('link', { name: /dashboard/i })
    expect(dashLink).toHaveClass('bg-gray-700')
  })
})
