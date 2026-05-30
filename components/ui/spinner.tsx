'use client'

import { cn } from '@/lib/utils'
import type { SpinnerProps } from '@/lib/types'

const sizeMap: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-[3px]',
}

export function Spinner({ size = 'md' }: SpinnerProps): React.ReactElement {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        'inline-block animate-spin rounded-full border-current border-t-transparent',
        sizeMap[size]
      )}
    />
  )
}
