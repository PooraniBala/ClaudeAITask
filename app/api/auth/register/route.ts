import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { signJwt, UnauthorizedError } from '@/lib/auth'
import { setSessionCookie } from '@/lib/cookies'
import { RegisterSchema } from '@/lib/validators'
import type { ApiResponse, UserInfo } from '@/lib/types'

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

  const parsed = RegisterSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 422 }
    )
  }

  const { email, password } = parsed.data
  const passwordHash = await bcrypt.hash(password, 10)

  let user: { id: string; email: string }
  try {
    user = await prisma.user.create({
      data: { email, password_hash: passwordHash },
      select: { id: true, email: true },
    })
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return NextResponse.json(
        { data: null, error: 'Already exists' },
        { status: 409 }
      )
    }
    throw err
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
    { status: 201 }
  )
  setSessionCookie(res, token)

  return res
}

// Satisfy TS — UnauthorizedError is imported for consistency but not thrown here
void UnauthorizedError
