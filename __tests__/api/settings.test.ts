import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { PATCH } from '@/app/api/settings/route'
import { prisma } from '@/lib/prisma'
import { signJwt } from '@/lib/auth'

describe('PATCH /api/settings', () => {
  let userId: string
  let token: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: 'settings@example.com', password_hash: 'hash' },
    })
    userId = user.id
    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'settings-session',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    token = await signJwt({ userId, email: user.email, sessionId: session.id })
  })

  function makeRequest(body: unknown, auth = true): NextRequest {
    return new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Cookie: `devpulse_session=${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
  }

  it('updates github_token and returns 200 with user id and email', async () => {
    const req = makeRequest({ githubToken: 'ghp_test_token_abc123' })
    const res = await PATCH(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data.id).toBe(userId)
    expect(body.data.email).toBe('settings@example.com')

    const user = await prisma.user.findUnique({ where: { id: userId } })
    expect(user?.github_token).toBe('ghp_test_token_abc123')
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = makeRequest({ githubToken: 'ghp_token' }, false)
    const res = await PATCH(req)

    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `devpulse_session=${token}`,
      },
      body: 'not-json{{{',
    })
    const res = await PATCH(req)

    expect(res.status).toBe(400)
  })

  it('returns 422 when githubToken is empty string', async () => {
    const req = makeRequest({ githubToken: '' })
    const res = await PATCH(req)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toContain('Token is required')
  })

  it('returns 422 when githubToken field is missing', async () => {
    const req = makeRequest({})
    const res = await PATCH(req)

    expect(res.status).toBe(422)
  })

  it('response body never includes the token value itself', async () => {
    const req = makeRequest({ githubToken: 'ghp_secret_value' })
    const res = await PATCH(req)
    const text = await res.text()

    expect(text).not.toContain('ghp_secret_value')
  })
})
