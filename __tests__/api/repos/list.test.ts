import { describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/repos/route'
import { prisma } from '@/lib/prisma'
import { signJwt } from '@/lib/auth'

describe('GET /api/repos', () => {
  let userId: string
  let otherUserId: string
  let token: string

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: { email: 'repouser@example.com', password_hash: 'hash' },
    })
    userId = user.id
    const session = await prisma.session.create({
      data: {
        user_id: user.id,
        token: 'list-test-session',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
    token = await signJwt({ userId, email: user.email, sessionId: session.id })

    const other = await prisma.user.create({
      data: { email: 'otheruser@example.com', password_hash: 'hash' },
    })
    otherUserId = other.id
  })

  it('returns only repos belonging to the authenticated user', async () => {
    await prisma.repository.create({
      data: {
        github_id: 1001,
        name: 'my-repo',
        full_name: 'repouser/my-repo',
        url: 'https://github.com/repouser/my-repo',
        is_private: false,
        owner_id: userId,
      },
    })
    await prisma.repository.create({
      data: {
        github_id: 1002,
        name: 'other-repo',
        full_name: 'otheruser/other-repo',
        url: 'https://github.com/otheruser/other-repo',
        is_private: false,
        owner_id: otherUserId,
      },
    })

    const req = new NextRequest('http://localhost/api/repos', {
      headers: { Cookie: `devpulse_session=${token}` },
    })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].fullName).toBe('repouser/my-repo')
    expect(body.meta.total).toBe(1)
  })

  it('returns empty list with total 0 when user has no repos', async () => {
    const req = new NextRequest('http://localhost/api/repos', {
      headers: { Cookie: `devpulse_session=${token}` },
    })
    const res = await GET(req)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toEqual([])
    expect(body.meta.total).toBe(0)
  })

  it('returns 401 for unauthenticated request', async () => {
    const req = new NextRequest('http://localhost/api/repos')
    const res = await GET(req)

    expect(res.status).toBe(401)
  })
})
