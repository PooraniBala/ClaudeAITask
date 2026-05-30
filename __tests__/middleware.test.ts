import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { middleware } from '@/middleware'
import { signJwt } from '@/lib/auth'

async function makeRequest(
  path: string,
  token?: string
): Promise<NextRequest> {
  const headers: Record<string, string> = {}
  if (token) headers['Cookie'] = `devpulse_session=${token}`
  return new NextRequest(`http://localhost:3000${path}`, { headers })
}

describe('middleware', () => {
  it('redirects unauthenticated request to / to /login', async () => {
    const req = await makeRequest('/')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redirects unauthenticated request to /repos to /login', async () => {
    const req = await makeRequest('/repos')
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  it('redirects authenticated request to /login to /', async () => {
    const token = await signJwt({
      userId: 'u1',
      email: 'test@test.com',
      sessionId: 's1',
    })
    const req = await makeRequest('/login', token)
    const res = await middleware(req)
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toMatch(/localhost:3000\/?$/)
  })

  it('allows authenticated request to / through', async () => {
    const token = await signJwt({
      userId: 'u1',
      email: 'test@test.com',
      sessionId: 's1',
    })
    const req = await makeRequest('/', token)
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })

  it('never blocks API routes regardless of auth state', async () => {
    const req = await makeRequest('/api/auth/login')
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })

  it('never blocks /api/auth/register', async () => {
    const req = await makeRequest('/api/auth/register')
    const res = await middleware(req)
    expect(res.status).toBe(200)
  })
})
