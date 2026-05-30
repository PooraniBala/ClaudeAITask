'use client'

import { useState } from 'react'
import { PageShell } from '@/components/layout/page-shell'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function SettingsPage(): React.ReactElement {
  const [token, setToken] = useState('')
  const [show, setShow] = useState(false)
  const [saving, setSaving] = useState(false)
  const [banner, setBanner] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setBanner(null)
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubToken: token }),
      })
      const body = (await res.json()) as { error: string | null }
      if (!res.ok) {
        setBanner({ type: 'error', message: body.error ?? 'Failed to save' })
        return
      }
      setToken('')
      setBanner({ type: 'success', message: 'GitHub token saved successfully' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageShell title="Settings" description="Manage your account and integrations">
      {banner && (
        <div
          role="alert"
          className={`fixed right-4 top-4 z-50 rounded-md px-4 py-3 text-sm text-white shadow-lg ${
            banner.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {banner.message}
          <button
            type="button"
            className="ml-3 font-bold opacity-70 hover:opacity-100"
            onClick={() => setBanner(null)}
          >
            ×
          </button>
        </div>
      )}

      <div className="max-w-lg space-y-6">
        <Card>
          <h2 className="mb-1 text-sm font-semibold text-gray-700">
            GitHub Integration
          </h2>
          <p className="mb-4 text-xs text-gray-500">
            Enter your GitHub Personal Access Token to allow DevPulse to fetch
            private repository data.
          </p>
          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label
                htmlFor="gh-token"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Personal Access Token
              </label>
              <div className="flex gap-2">
                <input
                  id="gh-token"
                  type={show ? 'text' : 'password'}
                  placeholder="ghp_••••••••••••"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShow((s) => !s)}
                >
                  {show ? 'Hide' : 'Show'}
                </Button>
              </div>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={saving}
            >
              Save token
            </Button>
          </form>
        </Card>
      </div>
    </PageShell>
  )
}
