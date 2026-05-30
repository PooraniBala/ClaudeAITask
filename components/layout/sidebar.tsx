'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { SidebarProps } from '@/lib/types'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', shortLabel: 'D' },
  { href: '/repos', label: 'Repos', shortLabel: 'R' },
  { href: '/settings', label: 'Settings', shortLabel: 'S' },
]

export function Sidebar({ activePath }: SidebarProps): React.ReactElement {
  const pathname = usePathname()
  const current = activePath || pathname

  return (
    <aside className="flex min-h-screen w-14 flex-col bg-gray-900 sm:w-56">
      <div className="flex flex-col gap-1 p-2 pt-4 sm:p-3 sm:pt-6">
        {NAV_ITEMS.map((item) => {
          const isActive = current === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center text-xs font-bold sm:hidden">
                {item.shortLabel}
              </span>
              <span className="hidden sm:block">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </aside>
  )
}
