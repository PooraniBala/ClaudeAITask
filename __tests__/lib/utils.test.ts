import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cn, fetcher } from '@/lib/utils'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional falsy values', () => {
    expect(cn('base', false && 'skipped', 'added')).toBe('base added')
  })

  it('deduplicates conflicting Tailwind classes (last wins)', () => {
    const result = cn('text-red-500', 'text-blue-500')
    expect(result).not.toContain('text-red-500')
    expect(result).toContain('text-blue-500')
  })
})

describe('fetcher', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('returns parsed JSON for a 200 response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'value', error: null }),
    })

    const result = await fetcher<{ data: string; error: null }>('/api/test')
    expect(result).toEqual({ data: 'value', error: null })
    expect(mockFetch).toHaveBeenCalledWith('/api/test')
  })

  it('throws with body.error message on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
      json: () => Promise.resolve({ error: 'Something broke' }),
    })

    await expect(fetcher('/api/test')).rejects.toThrow('Something broke')
  })

  it('throws with statusText when body has no error field', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
      json: () => Promise.resolve({}),
    })

    await expect(fetcher('/api/test')).rejects.toThrow('Not Found')
  })

  it('throws with statusText when response body is not JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Gateway',
      json: () => Promise.reject(new SyntaxError('not json')),
    })

    await expect(fetcher('/api/test')).rejects.toThrow('Bad Gateway')
  })
})
