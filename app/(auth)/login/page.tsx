'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

function LoginForm(): React.ReactElement {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered') === 'true'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) {
        setError('Invalid email or password')
        return
      }
      router.push('/')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      {registered && (
        <div className="mb-4 rounded-md bg-green-50 px-4 py-3 text-sm text-green-700">
          Account created successfully — sign in below.
        </div>
      )}
      <h1 className="mb-6 text-xl font-bold text-gray-900">Sign in</h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={loading}
          className="w-full"
        >
          Sign in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        No account?{' '}
        <Link href="/register" className="text-blue-600 underline">
          Register
        </Link>
      </p>
    </Card>
  )
}

export default function LoginPage(): React.ReactElement {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
