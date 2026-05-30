'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSWRConfig } from 'swr'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'
import type { RepoSelectorProps } from '@/lib/types'

type SyncState = { syncing: boolean; error: string | null }

function RefreshIcon(): React.ReactElement {
  return (
    <svg
      className="h-3.5 w-3.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  )
}

export function RepoSelector({
  repos,
  selectedId,
  onSelect,
  isLoading,
}: RepoSelectorProps): React.ReactElement {
  const { mutate } = useSWRConfig()
  const [syncStates, setSyncStates] = useState<Record<string, SyncState>>({})

  async function handleRefresh(repoId: string, e: React.MouseEvent): Promise<void> {
    e.stopPropagation()
    setSyncStates((prev) => ({ ...prev, [repoId]: { syncing: true, error: null } }))
    try {
      const res = await fetch(`/api/repos/${repoId}/sync`, { method: 'POST' })
      if (res.status === 429) {
        const body = (await res.json()) as { meta?: { retryAfter?: number } }
        const mins = body.meta?.retryAfter ? Math.ceil(body.meta.retryAfter / 60) : '?'
        setSyncStates((prev) => ({
          ...prev,
          [repoId]: { syncing: false, error: `Rate limited — try again in ${mins} minutes` },
        }))
        return
      }
      if (!res.ok) {
        setSyncStates((prev) => ({ ...prev, [repoId]: { syncing: false, error: 'Sync failed' } }))
        return
      }
      setSyncStates((prev) => ({ ...prev, [repoId]: { syncing: false, error: null } }))
      await mutate(
        (key) =>
          typeof key === 'string' &&
          (key.startsWith(`/api/metrics/${repoId}`) || key === '/api/dashboard')
      )
    } catch {
      setSyncStates((prev) => ({ ...prev, [repoId]: { syncing: false, error: 'Sync failed' } }))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Spinner size="sm" />
        <span>Loading repos…</span>
      </div>
    )
  }

  if (repos.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No repos connected.{' '}
        <Link href="/repos" className="text-blue-600 underline">
          Connect one
        </Link>
      </p>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-1">
      {repos.map((r) => {
        const state = syncStates[r.id]
        return (
          <div key={r.id} className="flex flex-col">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(r.id)}
                className={cn(
                  'flex-1 truncate rounded px-2 py-1 text-left text-sm transition-colors',
                  r.id === selectedId
                    ? 'bg-blue-100 font-medium text-blue-800'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                {r.fullName}
              </button>
              <button
                type="button"
                disabled={state?.syncing}
                onClick={(e) => handleRefresh(r.id, e)}
                className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Refresh ${r.fullName}`}
                title="Refresh metrics"
              >
                {state?.syncing ? <Spinner size="sm" /> : <RefreshIcon />}
              </button>
            </div>
            {state?.error && (
              <p className="mt-0.5 pl-2 text-xs text-yellow-700">{state.error}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
