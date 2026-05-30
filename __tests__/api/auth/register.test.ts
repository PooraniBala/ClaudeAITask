import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '@/app/api/auth/register/route'
import { prisma } from '@/lib/prisma'

function makeRegisterRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/register', () => {
  it('creates user and returns 201 with id and email', async () => {
    const req = makeRegisterRequest({
      email: 'alice@example.com',
      password: 'password123',
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.error).toBeNull()
    expect(body.data.email).toBe('alice@example.com')
    expect(body.data.id).toBeDefined()
  })

  it('sets httpOnly access_token cookie on success', async () => {
    const req = makeRegisterRequest({
      email: 'cookie@example.com',
      password: 'password123',
    })
    const res = await POST(req)

    expect(res.status).toBe(201)
    const setCookies = res.headers.getSetCookie()
    const accessCookie = setCookies.find((c) => c.startsWith('devpulse_session='))
    expect(accessCookie).toBeDefined()
    expect(accessCookie).toContain('HttpOnly')
  })

  it('never includes password or passwordHash in response', async () => {
    const req = makeRegisterRequest({
      email: 'safe@example.com',
      password: 'password123',
    })
    const res = await POST(req)
    const text = await res.text()

    expect(text).not.toContain('password')
    expect(text).not.toContain('hash')
  })

  it('returns 409 when email already exists', async () => {
    await prisma.user.create({
      data: {
        email: 'dup@example.com',
        password_hash: 'irrelevant',
      },
    })

    const req = makeRegisterRequest({
      email: 'dup@example.com',
      password: 'password123',
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(409)
    expect(body.data).toBeNull()
    expect(body.error).toBeTruthy()
  })

  it('returns 422 for missing email', async () => {
    const req = makeRegisterRequest({ password: 'password123' })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.data).toBeNull()
    expect(body.error).toBeTruthy()
  })

  it('returns 422 for invalid email format', async () => {
    const req = makeRegisterRequest({
      email: 'not-an-email',
      password: 'password123',
    })
    const res = await POST(req)

    expect(res.status).toBe(422)
  })

  it('returns 422 when password is fewer than 8 characters', async () => {
    const req = makeRegisterRequest({
      email: 'short@example.com',
      password: 'short',
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error).toContain('8')
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = new NextRequest('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    })
    const res = await POST(req)

    expect(res.status).toBe(400)
  })

  it('stores password as bcrypt hash (never plaintext)', async () => {
    const req = makeRegisterRequest({
      email: 'hashcheck@example.com',
      password: 'mypassword1',
    })
    await POST(req)

    const user = await prisma.user.findUnique({ where: { email: 'hashcheck@example.com' } })
    expect(user?.password_hash).toMatch(/^\$2b\$/)
    expect(user?.password_hash).not.toBe('mypassword1')
  })

  it('creates a Session record on successful registration', async () => {
    const req = makeRegisterRequest({
      email: 'newsession@example.com',
      password: 'password123',
    })
    const res = await POST(req)
    const body = await res.json()

    expect(res.status).toBe(201)
    const session = await prisma.session.findFirst({
      where: { user: { email: 'newsession@example.com' } },
    })
    expect(session).not.toBeNull()
    expect(body.data.id).toBeDefined()
  })
})
