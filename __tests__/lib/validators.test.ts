import { describe, it, expect } from 'vitest'
import {
  RegisterSchema,
  LoginSchema,
  ConnectRepoSchema,
  PeriodQuerySchema,
  periodToDbEnum,
} from '@/lib/validators'
import { MetricPeriod } from '@prisma/client'

describe('RegisterSchema', () => {
  it('passes with valid email and password ≥ 8 chars', () => {
    const result = RegisterSchema.safeParse({
      email: 'user@example.com',
      password: 'password1',
    })
    expect(result.success).toBe(true)
  })

  it('fails with invalid email format', () => {
    const result = RegisterSchema.safeParse({
      email: 'not-an-email',
      password: 'password1',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('email')
  })

  it('fails with password shorter than 8 characters', () => {
    const result = RegisterSchema.safeParse({
      email: 'user@example.com',
      password: 'short',
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('8')
  })

  it('fails when email is missing', () => {
    const result = RegisterSchema.safeParse({ password: 'password1' })
    expect(result.success).toBe(false)
  })

  it('fails when password is missing', () => {
    const result = RegisterSchema.safeParse({ email: 'user@example.com' })
    expect(result.success).toBe(false)
  })

  it('strips unknown fields', () => {
    const result = RegisterSchema.safeParse({
      email: 'user@example.com',
      password: 'password1',
      role: 'admin',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(Object.keys(result.data)).not.toContain('role')
    }
  })

  it('fails with empty object', () => {
    const result = RegisterSchema.safeParse({})
    expect(result.success).toBe(false)
    expect(result.error?.issues.length).toBeGreaterThan(0)
  })
})

describe('LoginSchema', () => {
  it('passes with valid email and non-empty password', () => {
    const result = LoginSchema.safeParse({ email: 'u@x.com', password: 'pw' })
    expect(result.success).toBe(true)
  })

  it('fails with empty password', () => {
    const result = LoginSchema.safeParse({ email: 'u@x.com', password: '' })
    expect(result.success).toBe(false)
  })

  it('fails with invalid email', () => {
    const result = LoginSchema.safeParse({ email: 'bad', password: 'pw' })
    expect(result.success).toBe(false)
  })
})

describe('ConnectRepoSchema', () => {
  it('passes with a valid https URL', () => {
    const result = ConnectRepoSchema.safeParse({
      url: 'https://github.com/owner/repo',
    })
    expect(result.success).toBe(true)
  })

  it('fails when url field is missing', () => {
    const result = ConnectRepoSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('fails with a non-URL string', () => {
    const result = ConnectRepoSchema.safeParse({ url: 'not-a-url' })
    expect(result.success).toBe(false)
  })

  it('passes the schema even with a non-GitHub URL (route handles that)', () => {
    // Schema only validates URL shape, not that it's GitHub
    const result = ConnectRepoSchema.safeParse({ url: 'https://gitlab.com/o/r' })
    expect(result.success).toBe(true)
  })
})

describe('PeriodQuerySchema', () => {
  it.each(['7d', '30d', '90d'])('passes for valid period "%s"', (period) => {
    const result = PeriodQuerySchema.safeParse({ period })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.period).toBe(period)
  })

  it('defaults to "30d" when period is undefined', () => {
    const result = PeriodQuerySchema.safeParse({ period: undefined })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.period).toBe('30d')
  })

  it.each(['1d', '60d', '', 'daily'])('fails for invalid period "%s"', (period) => {
    const result = PeriodQuerySchema.safeParse({ period })
    expect(result.success).toBe(false)
  })

  it('fails when period is a number', () => {
    const result = PeriodQuerySchema.safeParse({ period: 7 })
    expect(result.success).toBe(false)
  })
})

describe('periodToDbEnum', () => {
  it('maps 7d to SEVEN_DAYS', () => {
    expect(periodToDbEnum['7d']).toBe(MetricPeriod.SEVEN_DAYS)
  })
  it('maps 30d to THIRTY_DAYS', () => {
    expect(periodToDbEnum['30d']).toBe(MetricPeriod.THIRTY_DAYS)
  })
  it('maps 90d to NINETY_DAYS', () => {
    expect(periodToDbEnum['90d']).toBe(MetricPeriod.NINETY_DAYS)
  })
})
