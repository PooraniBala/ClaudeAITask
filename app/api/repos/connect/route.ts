import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth, UnauthorizedError } from '@/lib/auth'
import { ConnectRepoSchema } from '@/lib/validators'
import { fetchRepoMetadata, McpError } from '@/lib/github'
import { syncRepoMetrics } from '@/lib/sync'
import type { ApiResponse, RepoInfo } from '@/lib/types'

export async function POST(
  req: NextRequest
): Promise<NextResponse<ApiResponse<RepoInfo>>> {
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

  const parsed = ConnectRepoSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: parsed.error.issues[0].message },
      { status: 422 }
    )
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(parsed.data.url)
  } catch {
    return NextResponse.json(
      { data: null, error: 'Must be a valid URL' },
      { status: 422 }
    )
  }

  if (parsedUrl.hostname !== 'github.com') {
    return NextResponse.json(
      { data: null, error: 'URL must be a github.com repository' },
      { status: 422 }
    )
  }

  const segments = parsedUrl.pathname.split('/').filter(Boolean)
  if (segments.length < 2) {
    return NextResponse.json(
      { data: null, error: 'URL must point to a GitHub repository (owner/name)' },
      { status: 422 }
    )
  }

  const fullName = `${segments[0]}/${segments[1]}`

  let metadata: Awaited<ReturnType<typeof fetchRepoMetadata>>
  try {
    metadata = await fetchRepoMetadata(fullName)
  } catch (err) {
    if (err instanceof McpError) {
      if (err.code === 'NOT_FOUND') {
        return NextResponse.json(
          { data: null, error: 'Repository not found or access denied' },
          { status: 404 }
        )
      }
      if (err.code === 'RATE_LIMITED') {
        return NextResponse.json(
          { data: null, error: 'GitHub rate limit exceeded', meta: { retryAfter: err.retryAfter } },
          { status: 429 }
        )
      }
    }
    throw err
  }

  const repo = await prisma.repository.upsert({
    where: { github_id: metadata.githubId },
    update: {
      name: metadata.name,
      full_name: metadata.fullName,
      url: metadata.url,
      is_private: metadata.isPrivate,
      owner_id: session.userId,
    },
    create: {
      github_id: metadata.githubId,
      name: metadata.name,
      full_name: metadata.fullName,
      url: metadata.url,
      is_private: metadata.isPrivate,
      owner_id: session.userId,
    },
  })

  try {
    await syncRepoMetrics(repo.id, fullName, '30d')
  } catch (err) {
    if (err instanceof McpError) {
      if (err.code === 'RATE_LIMITED') {
        return NextResponse.json(
          { data: null, error: 'GitHub rate limit exceeded', meta: { retryAfter: err.retryAfter } },
          { status: 429 }
        )
      }
    }
    // Non-fatal: repo connected but metrics not yet populated
    console.error('[connect] syncRepoMetrics failed:', err)
  }

  const refreshed = await prisma.repository.findUniqueOrThrow({
    where: { id: repo.id },
  })

  const data: RepoInfo = {
    id: refreshed.id,
    githubId: refreshed.github_id,
    name: refreshed.name,
    fullName: refreshed.full_name,
    url: refreshed.url,
    isPrivate: refreshed.is_private,
    lastSyncedAt: refreshed.last_synced_at?.toISOString() ?? null,
    createdAt: refreshed.created_at.toISOString(),
  }

  return NextResponse.json<ApiResponse<RepoInfo>>(
    { data, error: null },
    { status: 201 }
  )
}
