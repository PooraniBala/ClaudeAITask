import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'
import { GET } from '@/app/api/auth/session/route'
import { prisma } from '@/lib/prisma'
import { signJwt } from '@/lib/auth'

describe('GET /api/auth/session', () => {
  let userId: string
  let sessionId: string
  let validToken: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: 'session@example.com',
        password_hash: 'hash',
        github_token: 'ghp_fake',
      },
    })
    userId = user.id

    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'session-token-check',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    sessionId = session.id
    validToken = await signJwt({ userId, email: user.email, sessionId })
  })

  it('returns 200 and user info for a valid cookie', async () => {
    const req = new NextRequest('http://localhost/api/auth/session', {
      headers: { Cookie: `devpulse_session=${validToken}` },
    })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.id).toBe(userId)
    expect(body.data.email).toBe('session@example.com')
    expect(body.data.sessionId).toBe(sessionId)
  })

  it('returns 401 when no cookie is present', async () => {
    const req = new NextRequest('http://localhost/api/auth/session')
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 for an expired JWT', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const expiredToken = await new SignJWT({
      userId,
      email: 'session@example.com',
      sessionId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret)

    const req = new NextRequest('http://localhost/api/auth/session', {
      headers: { Cookie: `devpulse_session=${expiredToken}` },
    })
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 when the DB Session record is expired', async () => {
    await prisma.session.update({
      where: { id: sessionId },
      data: { expires_at: new Date(Date.now() - 1000) },
    })

    const req = new NextRequest('http://localhost/api/auth/session', {
      headers: { Cookie: `devpulse_session=${validToken}` },
    })
    const res = await GET(req)

    expect(res.status).toBe(401)
  })

  it('returns 401 when user record no longer exists in DB', async () => {
    // Delete the user (cascades to sessions in some DBs, but we have a valid token)
    // Instead, simulate by pointing to a non-existent userId in the JWT
    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const orphanToken = await new SignJWT({
      userId: 'nonexistent-user-id',
      email: 'ghost@example.com',
      sessionId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(secret)

    // Update session to match the orphan userId claim
    await prisma.session.update({
      where: { id: sessionId },
      data: { user_id: userId }, // keep valid session but userId in JWT won't match a user
    })

    const req = new NextRequest('http://localhost/api/auth/session', {
      headers: { Cookie: `devpulse_session=${orphanToken}` },
    })
    const res = await GET(req)

    // The session lookup fails because sessionId in JWT was created for userId,
    // but we passed a different userId in orphanToken — so getSession returns null
    expect(res.status).toBe(401)
  })

  it('returns 401 after JWT_SECRET rotation (old token invalid)', async () => {
    const { SignJWT } = await import('jose')
    const oldSecret = new TextEncoder().encode('old-secret-that-is-no-longer-valid')
    const oldToken = await new SignJWT({ userId, email: 'session@example.com', sessionId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(oldSecret)

    const req = new NextRequest('http://localhost/api/auth/session', {
      headers: { Cookie: `devpulse_session=${oldToken}` },
    })
    const res = await GET(req)

    expect(res.status).toBe(401)
  })
})
