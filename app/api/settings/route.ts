import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth, UnauthorizedError } from '@/lib/auth'
import type { ApiResponse, UserInfo } from '@/lib/types'

const SettingsSchema = z.object({
  githubToken: z.string().min(1, 'Token is required'),
})

export async function PATCH(
  req: NextRequest
): Promise<NextResponse<ApiResponse<Pick<UserInfo, 'id' | 'email'>>>> {
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { data: null, error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parsed = SettingsSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 422 }
    )
  }

  const user = await prisma.user.update({
    where: { id: session.userId },
    data: { github_token: parsed.data.githubToken },
    select: { id: true, email: true },
  })

  return NextResponse.json(
    { data: { id: user.id, email: user.email }, error: null },
    { status: 200 }
  )
}
