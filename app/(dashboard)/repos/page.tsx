'use client'

import { useState, useEffect, useRef } from 'react'
import useSWR from 'swr'
import { fetcher } from '@/lib/utils'
import { PageShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { ApiResponse, RepoInfo } from '@/lib/types'

type RateLimitState = { retryAfter: number; remaining: number } | null

export default function ReposPage(): React.ReactElement {
  const { data, isLoading, mutate } = useSWR<ApiResponse<RepoInfo[]>>(
    '/api/repos',
    fetcher
  )

  const [url, setUrl] = useState('')
  const [connectError, setConnectError] = useState<string | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimitState>(null)
  const [connecting, setConnecting] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!rateLimit) return
    timerRef.current = setInterval(() => {
      setRateLimit((prev) => {
        if (!prev || prev.remaining <= 1) {
          clearInterval(timerRef.current ?? undefined)
          return null
        }
        return { ...prev, remaining: prev.remaining - 1 }
      })
    }, 1000)
    return () => clearInterval(timerRef.current ?? undefined)
  }, [rateLimit?.retryAfter])

  const repos = data?.data ?? []

  async function handleConnect(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setConnectError(null)
    setRateLimit(null)
    setConnecting(true)
    try {
      const res = await fetch('/api/repos/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const body = (await res.json()) as {
        error: string | null
        meta?: { retryAfter?: number }
      }

      if (res.status === 429) {
        const retryAfter = body.meta?.retryAfter ?? 60
        setRateLimit({ retryAfter, remaining: retryAfter })
        return
      }
      if (res.status === 404) {
        setConnectError(
          'Repository not found or private — check your GitHub token has repo scope'
        )
        return
      }
      if (!res.ok) {
        setConnectError(body.error ?? 'Failed to connect repo')
        return
      }
      setUrl('')
      await mutate()
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect(repoId: string): Promise<void> {
    await fetch(`/api/repos/${repoId}`, { method: 'DELETE' })
    await mutate()
  }

  return (
    <PageShell
      title="Repositories"
      description="Manage your connected GitHub repositories"
    >
      {/* Connect form */}
      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">
          Connect a Repository
        </h2>
        <form onSubmit={handleConnect} className="flex gap-3">
          <input
            type="url"
            placeholder="https://github.com/owner/repo"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            isLoading={connecting}
            disabled={!!rateLimit}
          >
            Connect
          </Button>
        </form>

        {rateLimit && (
          <div className="mt-2 flex items-center gap-2">
            <Badge label="GitHub rate limited" variant="warning" />
            <span className="text-xs text-yellow-700">
              Try again in {rateLimit.remaining}s
            </span>
          </div>
        )}

        {connectError && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {connectError}
          </p>
        )}
      </Card>

      {/* Repo list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : repos.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-gray-400">
          <svg
            className="h-10 w-10"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
            />
          </svg>
          <p className="text-sm">
            No repositories connected yet. Add one above.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((repo) => (
            <Card key={repo.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">
                    {repo.fullName}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {repo.lastSyncedAt
                      ? `Synced ${new Date(repo.lastSyncedAt).toLocaleDateString()}`
                      : 'Never synced'}
                  </p>
                </div>
                <Badge
                  label={repo.isPrivate ? 'private' : 'public'}
                  variant={repo.isPrivate ? 'warning' : 'success'}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDisconnect(repo.id)}
                >
                  Disconnect
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  )
}
