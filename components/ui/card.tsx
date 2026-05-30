import { cn } from '@/lib/utils'
import type { CardProps } from '@/lib/types'

export function Card({ children, className }: CardProps): React.ReactElement {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 bg-white p-6 shadow-sm',
        className
      )}
    >
      {children}
    </div>
  )
}
