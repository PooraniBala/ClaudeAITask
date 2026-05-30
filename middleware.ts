import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import type { JwtPayload } from '@/lib/types'

// Inline JWT verification — avoids importing lib/auth.ts which pulls in Prisma,
// keeping this file compatible with the Next.js Edge Runtime.
async function verifyToken(token: string): Promise<JwtPayload | null> {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    )
    return payload as unknown as JwtPayload
  } catch {
    return null
  }
}

const PROTECTED = new Set(['/', '/repos', '/settings'])

function isProtected(pathname: string): boolean {
  return PROTECTED.has(pathname) || pathname.startsWith('/repos/')
}

function isAuthPage(pathname: string): boolean {
  return pathname === '/login' || pathname === '/register'
}

export async function middleware(
  request: NextRequest
): Promise<NextResponse> {
  const { pathname } = request.nextUrl

  // API routes handle their own auth via requireAuth — never block them here
  if (pathname.startsWith('/api/')) return NextResponse.next()

  const token = request.cookies.get('devpulse_session')?.value
  const payload = token ? await verifyToken(token) : null

  if (isProtected(pathname) && !payload) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthPage(pathname) && payload) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
