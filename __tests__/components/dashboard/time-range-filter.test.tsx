// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TimeRangeFilter } from '@/components/dashboard/time-range-filter'

describe('TimeRangeFilter', () => {
  it('renders all three buttons', () => {
    render(<TimeRangeFilter value="30d" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument()
  })

  it('highlights the active range', () => {
    render(<TimeRangeFilter value="30d" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '30d' })).toHaveClass('bg-blue-600')
    expect(screen.getByRole('button', { name: '7d' })).not.toHaveClass('bg-blue-600')
  })

  it('calls onChange with the selected value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeRangeFilter value="30d" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '7d' }))
    expect(onChange).toHaveBeenCalledWith('7d')
  })

  it('calls onChange with 90d when 90d is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TimeRangeFilter value="30d" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: '90d' }))
    expect(onChange).toHaveBeenCalledWith('90d')
  })
})
