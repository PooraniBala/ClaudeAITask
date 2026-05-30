import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import bcrypt from 'bcrypt'
import { POST } from '@/app/api/auth/login/route'
import { prisma } from '@/lib/prisma'

const TEST_EMAIL = 'loginuser@example.com'
const TEST_PASSWORD = 'password123'

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await prisma.user.create({
      data: {
        email: TEST_EMAIL,
        password_hash: await bcrypt.hash(TEST_PASSWORD, 10),
      },
    })
  })

  function makeLoginRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('returns 200 and sets httpOnly access_token cookie for valid credentials', async () => {
    const req = makeLoginRequest({ email: TEST_EMAIL, password: TEST_PASSWORD })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.error).toBeNull()
    expect(body.data.email).toBe(TEST_EMAIL)

    const setCookies = res.headers.getSetCookie()
    const accessCookie = setCookies.find((c) => c.startsWith('devpulse_session='))
    expect(accessCookie).toBeDefined()
    expect(accessCookie).toContain('HttpOnly')
  })

  it('creates a Session record in the database on login', async () => {
    const req = makeLoginRequest({ email: TEST_EMAIL, password: TEST_PASSWORD })
    await POST(req)

    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
    const session = await prisma.session.findFirst({
      where: { user_id: user!.id },
    })
    expect(session).not.toBeNull()
    expect(session!.expires_at.getTime()).toBeGreaterThan(Date.now())
  })

  it('returns 401 for wrong password', async () => {
    const req = makeLoginRequest({ email: TEST_EMAIL, password: 'wrongpassword' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.data).toBeNull()
    expect(body.error).toBe('Invalid credentials')
  })

  it('returns 401 for unknown email (same message — no user enumeration)', async () => {
    const req = makeLoginRequest({
      email: 'nobody@example.com',
      password: TEST_PASSWORD,
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe('Invalid credentials')
  })

  it('returns 422 when body fails LoginSchema validation', async () => {
    const req = makeLoginRequest({ email: 'bad-email', password: '' })
    const res = await POST(req)

    expect(res.status).toBe(422)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{invalid json',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('login response cookie has HttpOnly and SameSite=Strict', async () => {
    const req = makeLoginRequest({ email: TEST_EMAIL, password: TEST_PASSWORD })
    const res = await POST(req)
    const setCookies = res.headers.getSetCookie()
    const cookie = setCookies.find((c) => c.startsWith('devpulse_session='))!

    expect(cookie).toContain('HttpOnly')
    expect(cookie.toLowerCase()).toContain('samesite=strict')
  })

  it('login response body never includes the JWT token string', async () => {
    const req = makeLoginRequest({ email: TEST_EMAIL, password: TEST_PASSWORD })
    const res = await POST(req)
    const body = await res.json()
    const bodyStr = JSON.stringify(body)

    // JWT tokens are base64url strings with dots — the response body should not have one
    expect(bodyStr).not.toMatch(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)
  })

  it('does not reuse an already-expired session token', async () => {
    const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } })
    await prisma.session.create({
      data: {
        user_id: user!.id,
        token: 'old-expired-token',
        expires_at: new Date(Date.now() - 1000),
      },
    })

    const req = makeLoginRequest({ email: TEST_EMAIL, password: TEST_PASSWORD })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    const sessions = await prisma.session.findMany({
      where: { user_id: user!.id },
    })
    const activeSession = sessions.find(
      (s) => s.token !== 'old-expired-token' && s.expires_at > new Date()
    )
    expect(activeSession).toBeDefined()
  })
})
