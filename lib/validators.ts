import { z } from 'zod'
import { MetricPeriod } from '@prisma/client'

export const RegisterSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .transform((v) => v.toLowerCase().trim()),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
}).strict()

export const LoginSchema = z.object({
  email: z
    .string()
    .email('Invalid email address')
    .max(255, 'Email too long')
    .transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required').max(128, 'Password too long'),
}).strict()

export const ConnectRepoSchema = z.object({
  url: z
    .string()
    .url('Must be a valid URL')
    .max(500, 'URL too long')
    .regex(
      /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/,
      'URL must be a github.com repository (https://github.com/owner/repo)'
    ),
}).strict()

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
