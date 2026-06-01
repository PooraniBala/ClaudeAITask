import { SignJWT, jwtVerify } from 'jose'
import type { NextRequest } from 'next/server'
import { prisma } from './prisma'
import type { JwtPayload } from './types'

export const COOKIE_NAME = 'devpulse_session'

export class UnauthorizedError extends Error {
  readonly status = 401
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters')
  return new TextEncoder().encode(secret)
}

export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret())
}

export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

export async function getSession(
  request: NextRequest
): Promise<JwtPayload | null> {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null

  const payload = await verifyJwt(token)
  if (!payload) return null

  const dbSession = await prisma.session.findUnique({
    where: { id: payload.sessionId },
  })
  if (!dbSession || dbSession.expires_at <= new Date()) return null

  return payload
}

export async function requireAuth(request: NextRequest): Promise<JwtPayload> {
  const session = await getSession(request)
  if (!session) throw new UnauthorizedError()
  await refreshSession(session.sessionId)
  return session
}

export async function refreshSession(sessionId: string): Promise<void> {
  try {
    await prisma.session.update({
      where: { id: sessionId },
      data: { expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    })
  } catch {
    // Session may have been concurrently deleted — safe to ignore
  }
}

// Backward-compatible alias used by older route files during migration
export const getSessionFromRequest = getSession
