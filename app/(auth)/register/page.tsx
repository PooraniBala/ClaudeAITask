'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const RegisterSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FieldErrors = Partial<Record<'email' | 'password' | 'confirmPassword', string>>

export default function RegisterPage(): React.ReactElement {
  const router = useRouter()
  const [fields, setFields] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function setField(k: keyof typeof fields) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [k]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setServerError(null)

    const result = RegisterSchema.safeParse(fields)
    if (!result.success) {
      const errs: FieldErrors = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors
        errs[key] = issue.message
      }
      setFieldErrors(errs)
      return
    }
    setFieldErrors({})
    setLoading(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fields.email,
          password: fields.password,
        }),
      })
      if (res.status === 409) {
        setServerError('Email already in use')
        return
      }
      if (!res.ok) {
        const body = (await res.json()) as { error: string | null }
        setServerError(body.error ?? 'Registration failed')
        return
      }
      router.push('/login?registered=true')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <h1 className="mb-6 text-xl font-bold text-gray-900">Create account</h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {(
          [
            { id: 'email', label: 'Email', type: 'email', auto: 'email' },
            {
              id: 'password',
              label: 'Password',
              type: 'password',
              auto: 'new-password',
            },
            {
              id: 'confirmPassword',
              label: 'Confirm password',
              type: 'password',
              auto: 'new-password',
            },
          ] as const
        ).map(({ id, label, type, auto }) => (
          <div key={id}>
            <label
              htmlFor={id}
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {label}
            </label>
            <input
              id={id}
              type={type}
              autoComplete={auto}
              value={fields[id]}
              onChange={setField(id)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {fieldErrors[id] && (
              <p role="alert" className="mt-1 text-xs text-red-600">
                {fieldErrors[id]}
              </p>
            )}
          </div>
        ))}
        {serverError && (
          <p role="alert" className="text-sm text-red-600">
            {serverError}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={loading}
          className="w-full"
        >
          Create account
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="text-blue-600 underline">
          Sign in
        </Link>
      </p>
    </Card>
  )
}
