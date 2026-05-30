import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import type { StatCardProps } from '@/lib/types'

export function StatCard({
  label,
  value,
  delta,
  isLoading,
}: StatCardProps): React.ReactElement {
  if (isLoading) {
    return (
      <Card>
        <div className="animate-pulse space-y-2">
          <div className="h-3 w-24 rounded bg-gray-200" />
          <div className="h-7 w-16 rounded bg-gray-200" />
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      {delta !== undefined && (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-sm font-medium',
            delta >= 0 ? 'text-green-600' : 'text-red-600'
          )}
        >
          <span>{delta >= 0 ? '↑' : '↓'}</span>
          <span>{Math.abs(delta)}%</span>
        </p>
      )}
    </Card>
  )
}
