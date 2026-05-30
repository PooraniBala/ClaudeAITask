import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession, UnauthorizedError } from '@/lib/auth'
import { clearSessionCookie } from '@/lib/cookies'
import type { ApiResponse } from '@/lib/types'

export async function DELETE(
  req: NextRequest
): Promise<NextResponse<ApiResponse<{ message: string }>>> {
  const session = await getSession(req)

  if (!session) {
    return NextResponse.json(
      { data: null, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  await prisma.session.deleteMany({ where: { id: session.sessionId } })

  const res = NextResponse.json<ApiResponse<{ message: string }>>(
    { data: { message: 'Logged out' }, error: null },
    { status: 200 }
  )
  clearSessionCookie(res)

  return res
}

// Keep UnauthorizedError in scope to satisfy linter if imported elsewhere
void UnauthorizedError
