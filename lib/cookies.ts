import type { NextResponse } from 'next/server'
import { COOKIE_NAME } from './auth'

const MAX_AGE_7D = 60 * 60 * 24 * 7

function cookieOptions(maxAge: number): {
  httpOnly: boolean
  secure: boolean
  sameSite: 'strict'
  maxAge: number
  path: string
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge,
    path: '/',
  }
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, cookieOptions(MAX_AGE_7D))
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(COOKIE_NAME, '', cookieOptions(0))
}
