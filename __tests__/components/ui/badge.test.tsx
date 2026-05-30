// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Badge } from '@/components/ui/badge'

describe('Badge', () => {
  it('renders label text', () => {
    render(<Badge label="public" variant="success" />)
    expect(screen.getByText('public')).toBeInTheDocument()
  })

  it('applies success variant classes', () => {
    render(<Badge label="ok" variant="success" />)
    expect(screen.getByText('ok')).toHaveClass('bg-green-100', 'text-green-800')
  })

  it('applies error variant classes', () => {
    render(<Badge label="fail" variant="error" />)
    expect(screen.getByText('fail')).toHaveClass('bg-red-100', 'text-red-800')
  })

  it('applies neutral variant classes', () => {
    render(<Badge label="neutral" variant="neutral" />)
    expect(screen.getByText('neutral')).toHaveClass('bg-gray-100')
  })
})
