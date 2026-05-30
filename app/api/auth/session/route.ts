import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, UnauthorizedError } from '@/lib/auth'
import type { ApiResponse, UserInfo } from '@/lib/types'

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<UserInfo & { sessionId: string }>>> {
  let session: Awaited<ReturnType<typeof requireAuth>>
  try {
    session = await requireAuth(req)
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }
    throw err
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true },
  })

  if (!user) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return NextResponse.json(
    {
      data: { id: user.id, email: user.email, sessionId: session.sessionId },
      error: null,
    },
    { status: 200 }
  )
}
