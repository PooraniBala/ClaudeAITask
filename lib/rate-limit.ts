type RateLimitOptions = { limit: number; windowMs: number }
type RateLimitResult = { success: boolean; remaining: number; resetAt: number }

const store = new Map<string, number[]>()

// Evict entries older than 1 hour to bound memory usage
function evict(): void {
  const cutoff = Date.now() - 3_600_000
  for (const [key, timestamps] of store) {
    const fresh = timestamps.filter((t) => t > cutoff)
    if (fresh.length === 0) store.delete(key)
    else store.set(key, fresh)
  }
}

let lastEvict = Date.now()

export function rateLimit(identifier: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()

  if (now - lastEvict > 300_000) {
    evict()
    lastEvict = now
  }

  const windowStart = now - options.windowMs
  const timestamps = (store.get(identifier) ?? []).filter((t) => t > windowStart)

  if (timestamps.length >= options.limit) {
    return {
      success: false,
      remaining: 0,
      resetAt: Math.min(...timestamps) + options.windowMs,
    }
  }

  store.set(identifier, [...timestamps, now])
  return {
    success: true,
    remaining: options.limit - timestamps.length - 1,
    resetAt: now + options.windowMs,
  }
}
