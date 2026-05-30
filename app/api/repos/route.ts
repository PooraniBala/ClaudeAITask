import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, UnauthorizedError } from '@/lib/auth'
import type { ApiResponse, RepoInfo } from '@/lib/types'

export async function GET(
  req: NextRequest
): Promise<NextResponse<ApiResponse<RepoInfo[]>>> {
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

  const repos = await prisma.repository.findMany({
    where: { owner_id: session.userId },
    orderBy: { created_at: 'desc' },
  })

  const data: RepoInfo[] = repos.map((r) => ({
    id: r.id,
    githubId: r.github_id,
    name: r.name,
    fullName: r.full_name,
    url: r.url,
    isPrivate: r.is_private,
    lastSyncedAt: r.last_synced_at?.toISOString() ?? null,
    createdAt: r.created_at.toISOString(),
  }))

  return NextResponse.json<ApiResponse<RepoInfo[]>>(
    { data, error: null, meta: { total: data.length } },
    { status: 200 }
  )
}
