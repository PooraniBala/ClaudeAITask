// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageShell } from '@/components/layout/page-shell'

describe('PageShell', () => {
  it('renders the title as h1', () => {
    render(<PageShell title="My Page"><div /></PageShell>)
    expect(screen.getByRole('heading', { name: 'My Page', level: 1 })).toBeInTheDocument()
  })

  it('renders optional description', () => {
    render(<PageShell title="T" description="Sub text"><div /></PageShell>)
    expect(screen.getByText('Sub text')).toBeInTheDocument()
  })

  it('does not render description element when omitted', () => {
    render(<PageShell title="T"><div /></PageShell>)
    expect(screen.queryByText('Sub text')).not.toBeInTheDocument()
  })

  it('renders children inside the shell', () => {
    render(<PageShell title="T"><span>child content</span></PageShell>)
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})
