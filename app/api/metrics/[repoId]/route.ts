import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, UnauthorizedError } from '@/lib/auth'
import { PeriodQuerySchema, periodToDbEnum } from '@/lib/validators'
import { syncRepoMetrics } from '@/lib/sync'
import type { ApiResponse, MetricInfo } from '@/lib/types'

const ONE_HOUR_MS = 60 * 60 * 1000

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ repoId: string }> }
): Promise<NextResponse<ApiResponse<MetricInfo[]>>> {
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

  const periodParam = req.nextUrl.searchParams.get('period') ?? '30d'
  const periodParsed = PeriodQuerySchema.safeParse({ period: periodParam })
  if (!periodParsed.success) {
    return NextResponse.json(
      { data: null, error: periodParsed.error.issues[0].message },
      { status: 422 }
    )
  }

  const period = periodParsed.data.period
  const dbPeriod = periodToDbEnum[period]

  const repo = await prisma.repository.findFirst({
    where: { id: repoId, owner_id: session.userId },
  })
  if (!repo) {
    return NextResponse.json(
      { data: null, error: 'Not found' },
      { status: 404 }
    )
  }

  const existingCount = await prisma.metric.count({
    where: { repo_id: repoId, period: dbPeriod },
  })

  const stale =
    existingCount === 0 ||
    !repo.last_synced_at ||
    Date.now() - repo.last_synced_at.getTime() > ONE_HOUR_MS

  if (stale) {
    try {
      await syncRepoMetrics(repoId, repo.full_name, period)
    } catch {
      // Serve stale/empty data rather than failing the request
    }
  }

  const metrics = await prisma.metric.findMany({
    where: { repo_id: repoId, period: dbPeriod },
    orderBy: { recorded_at: 'desc' },
  })

  const data: MetricInfo[] = metrics.map((m) => ({
    id: m.id,
    repoId: m.repo_id,
    type: m.type,
    period: m.period,
    payload: m.payload,
    recordedAt: m.recorded_at.toISOString(),
  }))

  return NextResponse.json<ApiResponse<MetricInfo[]>>(
    {
      data,
      error: null,
      meta: { total: data.length, synced: !!repo.last_synced_at },
    },
    { status: 200 }
  )
}
