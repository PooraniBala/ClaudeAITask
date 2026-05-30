'use client'

import useSWR from 'swr'
import { fetcher } from '@/lib/utils'
import type { ApiResponse, UserInfo } from '@/lib/types'

export type AuthUser = Pick<UserInfo, 'id' | 'email'>

export type AuthState = {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
}

export function useAuth(): AuthState {
  const { data, isLoading } = useSWR<ApiResponse<UserInfo>>(
    '/api/auth/session',
    fetcher,
    { shouldRetryOnError: false }
  )

  const user: AuthUser | null =
    data?.data ? { id: data.data.id, email: data.data.email } : null

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  }
}
