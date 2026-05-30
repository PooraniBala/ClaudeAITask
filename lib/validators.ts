import { z } from 'zod'
import { MetricPeriod } from '@prisma/client'

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const ConnectRepoSchema = z.object({
  url: z.string().url('Must be a valid URL'),
})

export const PeriodQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d']).default('30d'),
})

export const periodToDbEnum: Record<string, MetricPeriod> = {
  '7d': MetricPeriod.SEVEN_DAYS,
  '30d': MetricPeriod.THIRTY_DAYS,
  '90d': MetricPeriod.NINETY_DAYS,
}

export type RegisterInput = z.infer<typeof RegisterSchema>
export type LoginInput = z.infer<typeof LoginSchema>
export type ConnectRepoInput = z.infer<typeof ConnectRepoSchema>
export type PeriodQueryInput = z.infer<typeof PeriodQuerySchema>
