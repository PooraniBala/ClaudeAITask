/**
 * Full register → login → session → repos → logout → session(401) flow.
 * No mocks — all calls go through real API route handlers against the test DB.
 */
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as register } from '@/app/api/auth/register/route'
import { POST as login } from '@/app/api/auth/login/route'
import { GET as session } from '@/app/api/auth/session/route'
import { GET as reposList } from '@/app/api/repos/route'
import { DELETE as logout } from '@/app/api/auth/logout/route'

const EMAIL = 'flowtest@example.com'
const PASSWORD = 'FlowPassword1!'

function cookieFrom(res: Response): string {
  const setCookie = res.headers.getSetCookie()
  const found = setCookie.find((c) => c.startsWith('devpulse_session='))
  if (!found) throw new Error('No devpulse_session cookie in response')
  return found.split(';')[0].split('=').slice(1).join('=')
}

function authReq(method: string, url: string, sessionToken: string): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { Cookie: `devpulse_session=${sessionToken}` },
  })
}

describe('Auth flow: register → login → session → repos → logout → 401', () => {
  it('completes the full flow end-to-end', async () => {
    // Step 1: Register
    const regRes = await register(
      new NextRequest('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      })
    )
    expect(regRes.status).toBe(201)
    const regBody = await regRes.json()
    expect(regBody.data.email).toBe(EMAIL)
    expect(regBody.error).toBeNull()

    // Step 2: Login
    const loginRes = await login(
      new NextRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
      })
    )
    expect(loginRes.status).toBe(200)
    const sessionToken = cookieFrom(loginRes)
    expect(sessionToken).toBeTruthy()

    // Step 3: Session check
    const sessionRes = await session(authReq('GET', 'http://localhost/api/auth/session', sessionToken))
    expect(sessionRes.status).toBe(200)
    const sessionBody = await sessionRes.json()
    expect(sessionBody.data.email).toBe(EMAIL)

    // Step 4: Repos list (empty)
    const reposRes = await reposList(authReq('GET', 'http://localhost/api/repos', sessionToken))
    expect(reposRes.status).toBe(200)
    const reposBody = await reposRes.json()
    expect(reposBody.data).toEqual([])
    expect(reposBody.meta.total).toBe(0)

    // Step 5: Logout
    const logoutRes = await logout(authReq('DELETE', 'http://localhost/api/auth/logout', sessionToken))
    expect(logoutRes.status).toBe(200)
    const clearedCookie = logoutRes.headers.getSetCookie()
      .find((c) => c.startsWith('devpulse_session='))
    expect(clearedCookie).toMatch(/Max-Age=0|expires=Thu, 01 Jan 1970/i)

    // Step 6: Session after logout → 401
    const postLogoutRes = await session(authReq('GET', 'http://localhost/api/auth/session', sessionToken))
    expect(postLogoutRes.status).toBe(401)
  })
})
