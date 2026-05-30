import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, UnauthorizedError } from '@/lib/auth'
import { PeriodQuerySchema } from '@/lib/validators'
import { McpError } from '@/lib/github'
import { syncRepoMetrics } from '@/lib/sync'
import type { ApiResponse } from '@/lib/types'

type SyncResult = { synced: boolean; lastSyncedAt: string | null }

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
): Promise<NextResponse<ApiResponse<SyncResult>>> {
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

  const { repoId } = await params

  const repo = await prisma.repository.findFirst({
    where: { id: repoId, owner_id: session.userId },
  })
  if (!repo) {
    return NextResponse.json(
      { data: null, error: 'Not found' },
      { status: 404 }
    )
  }

  const periodParam = req.nextUrl.searchParams.get('period') ?? '30d'
  const periodParsed = PeriodQuerySchema.safeParse({ period: periodParam })
  const period = periodParsed.success ? periodParsed.data.period : '30d'

  try {
    await syncRepoMetrics(repo.id, repo.full_name, period)
  } catch (err) {
    if (err instanceof McpError) {
      if (err.code === 'RATE_LIMITED') {
        return NextResponse.json(
          { data: null, error: 'GitHub rate limit exceeded', meta: { retryAfter: err.retryAfter } },
          { status: 429 }
        )
      }
      if (err.code === 'NOT_FOUND') {
        return NextResponse.json(
          { data: null, error: 'Repository not found or access denied' },
          { status: 404 }
        )
      }
    }
    throw err
  }

  const updated = await prisma.repository.findUniqueOrThrow({
    where: { id: repo.id },
    select: { last_synced_at: true },
  })

  return NextResponse.json<ApiResponse<SyncResult>>(
    {
      data: { synced: true, lastSyncedAt: updated.last_synced_at?.toISOString() ?? null },
      error: null,
    },
    { status: 200 }
  )
}
