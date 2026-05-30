import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { prisma } from '@/lib/prisma'
import { signJwt } from '@/lib/auth'
import { setSessionCookie } from '@/lib/cookies'
import { LoginSchema } from '@/lib/validators'
import type { ApiResponse, UserInfo } from '@/lib/types'

const INVALID_CREDENTIALS = 'Invalid credentials'

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<UserInfo>>> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = LoginSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 422 }
    )
  }

  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, password_hash: true },
  })

  if (!user) {
    return NextResponse.json(
      { data: null, error: INVALID_CREDENTIALS },
      { status: 401 }
    )
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash)
  if (!passwordMatch) {
    return NextResponse.json(
      { data: null, error: INVALID_CREDENTIALS },
      { status: 401 }
    )
  }

  const session = await prisma.session.create({
    data: {
      user_id: user.id,
      token: randomUUID(),
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  const token = await signJwt({
    userId: user.id,
    email: user.email,
    sessionId: session.id,
  })

  const res = NextResponse.json<ApiResponse<UserInfo>>(
    { data: { id: user.id, email: user.email }, error: null },
    { status: 200 }
  )
  setSessionCookie(res, token)

  return res
}
