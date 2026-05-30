'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/hooks/use-auth'
import type { NavbarProps } from '@/lib/types'

export function Navbar({ user }: NavbarProps): React.ReactElement {
  const router = useRouter()
  const { user: authUser, isLoading } = useAuth()

  // Prefer live SWR state; fall back to server-passed prop during hydration
  const displayEmail = authUser?.email ?? user.email

  async function handleLogout(): Promise<void> {
    await fetch('/api/auth/logout', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          <span className="text-lg font-bold text-blue-600">DevPulse</span>
          <div className="flex items-center gap-3">
            {isLoading ? (
              <Spinner size="sm" />
            ) : (
              <span className="hidden text-sm text-gray-600 sm:block">
                {displayEmail}
              </span>
            )}
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  )
}
