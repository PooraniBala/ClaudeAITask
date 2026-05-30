'use client'

import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import type { ButtonProps } from '@/lib/types'

const variantMap: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary:
    'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
  secondary:
    'bg-gray-100 text-gray-900 hover:bg-gray-200 focus-visible:ring-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
}

const sizeMap: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({
  variant,
  size,
  isLoading = false,
  disabled = false,
  children,
  onClick,
  type = 'button',
  className,
}: ButtonProps): React.ReactElement {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        variantMap[variant],
        sizeMap[size],
        className
      )}
    >
      {isLoading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
