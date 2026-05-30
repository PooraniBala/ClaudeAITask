import { cn } from '@/lib/utils'
import type { BadgeProps } from '@/lib/types'

const variantMap: Record<NonNullable<BadgeProps['variant']>, string> = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800',
  neutral: 'bg-gray-100 text-gray-700',
}

export function Badge({ label, variant }: BadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantMap[variant]
      )}
    >
      {label}
    </span>
  )
}
