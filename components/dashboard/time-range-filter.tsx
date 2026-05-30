'use client'

import { cn } from '@/lib/utils'
import type { TimeRangeFilterProps, TimeRange } from '@/lib/types'

const RANGES: { value: TimeRange; label: string }[] = [
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: '90d', label: '90d' },
]

export function TimeRangeFilter({
  value,
  onChange,
}: TimeRangeFilterProps): React.ReactElement {
  return (
    <div
      role="group"
      aria-label="Time range filter"
      className="inline-flex rounded-md border border-gray-200 bg-white shadow-sm"
    >
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          aria-pressed={value === r.value}
          className={cn(
            'px-3 py-1.5 text-sm font-medium transition-colors first:rounded-l-md last:rounded-r-md',
            value === r.value
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 hover:bg-gray-50'
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
