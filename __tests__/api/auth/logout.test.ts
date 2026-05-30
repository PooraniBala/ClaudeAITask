import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { DELETE } from '@/app/api/auth/logout/route'
import { prisma } from '@/lib/prisma'
import { signJwt } from '@/lib/auth'

describe('DELETE /api/auth/logout', () => {
  let userId: string
  let sessionId: string
  let accessToken: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: 'logout@example.com', password_hash: 'hash' },
    })
    userId = user.id

    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'session-token-for-logout',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    sessionId = session.id

    accessToken = await signJwt({ userId, email: user.email, sessionId })
  })

  it('clears the access_token cookie and deletes the Session record', async () => {
    const req = new NextRequest('http://localhost/api/auth/logout', {
      method: 'DELETE',
      headers: { Cookie: `devpulse_session=${accessToken}` },
    })
    const res = await DELETE(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual({ message: 'Logged out' })

    const setCookies = res.headers.getSetCookie()
    const cleared = setCookies.find((c) => c.startsWith('devpulse_session='))
    expect(cleared).toBeDefined()
    expect(cleared).toMatch(/Max-Age=0|expires=Thu, 01 Jan 1970/i)

    const session = await prisma.session.findUnique({ where: { id: sessionId } })
    expect(session).toBeNull()
  })

  it('returns 401 when no cookie is present', async () => {
    const req = new NextRequest('http://localhost/api/auth/logout', {
      method: 'DELETE',
    })
    const res = await DELETE(req)

    expect(res.status).toBe(401)
  })

  it('logout clears cookie with Max-Age=0', async () => {
    const req = new NextRequest('http://localhost/api/auth/logout', {
      method: 'DELETE',
      headers: { Cookie: `devpulse_session=${accessToken}` },
    })
    const res = await DELETE(req)
    const cookies = res.headers.getSetCookie()
    const cleared = cookies.find((c) => c.startsWith('devpulse_session='))!

    expect(cleared).toMatch(/Max-Age=0/i)
  })

  it('deletes only the session matching the cookie, not other sessions', async () => {
    // Create a second session for the same user
    const otherSession = await prisma.session.create({
      data: {
        user_id: userId,
        token: 'other-session-token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const req = new NextRequest('http://localhost/api/auth/logout', {
      method: 'DELETE',
      headers: { Cookie: `devpulse_session=${accessToken}` },
    })
    await DELETE(req)

    const deleted = await prisma.session.findUnique({ where: { id: sessionId } })
    const kept = await prisma.session.findUnique({ where: { id: otherSession.id } })

    expect(deleted).toBeNull()
    expect(kept).not.toBeNull()
  })
})
