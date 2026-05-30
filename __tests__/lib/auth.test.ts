import { describe, it, expect, beforeEach } from 'vitest'
import { SignJWT } from 'jose'
import { signJwt, verifyJwt, getSession, refreshSession } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextRequest } from 'next/server'

const TEST_PAYLOAD = {
  userId: 'user-test-1',
  email: 'authtest@example.com',
  sessionId: 'session-test-1',
}

describe('getSecret — missing JWT_SECRET', () => {
  it('signJwt throws when JWT_SECRET env var is not set', async () => {
    vi.stubEnv('JWT_SECRET', '')
    await expect(signJwt(TEST_PAYLOAD)).rejects.toThrow('JWT_SECRET')
    vi.unstubAllEnvs()
  })
})

describe('signJwt / verifyJwt', () => {
  it('signJwt produces a JWT that verifyJwt can decode', async () => {
    const token = await signJwt(TEST_PAYLOAD)
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)

    const payload = await verifyJwt(token)
    expect(payload?.userId).toBe(TEST_PAYLOAD.userId)
    expect(payload?.email).toBe(TEST_PAYLOAD.email)
    expect(payload?.sessionId).toBe(TEST_PAYLOAD.sessionId)
  })

  it('verifyJwt returns null for an expired token', async () => {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!)
    const expired = await new SignJWT({ ...TEST_PAYLOAD })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret)

    expect(await verifyJwt(expired)).toBeNull()
  })

  it('verifyJwt returns null for a tampered token', async () => {
    const token = await signJwt(TEST_PAYLOAD)
    const [h, , s] = token.split('.')
    const tampered = `${h}.tampered_payload.${s}`
    expect(await verifyJwt(tampered)).toBeNull()
  })
})

describe('getSession', () => {
  let userId: string
  let sessionId: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: 'getsession@example.com', password_hash: 'hash' },
    })
    userId = user.id
    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'gs-session-token',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    sessionId = session.id
  })

  it('returns payload for a valid cookie + live DB session', async () => {
    const token = await signJwt({ userId, email: 'getsession@example.com', sessionId })
    const req = new NextRequest('http://localhost/', {
      headers: { Cookie: `devpulse_session=${token}` },
    })
    const result = await getSession(req)
    expect(result?.userId).toBe(userId)
    expect(result?.sessionId).toBe(sessionId)
  })

  it('returns null when DB Session.expiresAt is in the past', async () => {
    await prisma.session.update({
      where: { id: sessionId },
      data: { expires_at: new Date(Date.now() - 1000) },
    })
    const token = await signJwt({ userId, email: 'getsession@example.com', sessionId })
    const req = new NextRequest('http://localhost/', {
      headers: { Cookie: `devpulse_session=${token}` },
    })
    expect(await getSession(req)).toBeNull()
  })

  it('returns null when no cookie is present', async () => {
    const req = new NextRequest('http://localhost/')
    expect(await getSession(req)).toBeNull()
  })
})

describe('refreshSession', () => {
  it('extends Session.expiresAt by approximately 7 days', async () => {
    const user = await prisma.user.create({
      data: { email: 'refresh@example.com', password_hash: 'hash' },
    })
    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'refresh-token',
        expires_at: new Date(Date.now() + 60 * 1000), // 1 minute from now
      },
    })

    const before = Date.now()
    await refreshSession(session.id)

    const updated = await prisma.session.findUnique({ where: { id: session.id } })
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    expect(updated!.expires_at.getTime()).toBeGreaterThan(before + sevenDaysMs - 5000)
  })

  it('does not throw when sessionId does not exist', async () => {
    await expect(refreshSession('nonexistent-id')).resolves.toBeUndefined()
  })
})
