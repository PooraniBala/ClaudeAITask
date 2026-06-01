# Security Audit Report — DevPulse
**Date:** 2026-06-01
**Auditor:** Claude Code Security Review
**Scope:** All API routes, auth helpers, middleware, config files,
           frontend components, environment handling

## Summary

| Severity | Count | Fixed | Deferred |
|----------|-------|-------|----------|
| Critical | 0     | 0     | 0        |
| High     | 2     | 2     | 0        |
| Medium   | 5     | 5     | 0        |
| Low      | 2     | 1     | 1        |

---

## Findings

### FINDING-001 — No Rate Limiting on Login Endpoint

| Field    | Detail                                  |
|----------|-----------------------------------------|
| Severity | HIGH                                    |
| File     | `app/api/auth/login/route.ts`           |
| Line     | 12 (POST handler entry)                 |
| Status   | ✅ Fixed                                |

**Vulnerability:**
`POST /api/auth/login` had no rate limiting. An attacker could send unlimited
password guesses from a single IP, enabling brute-force attacks against any
account where the email is known or guessable.

**Evidence:**
```ts
// Before — no rate limiting, handler executes on every request
export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch { ... }
  ...
}
```

**Fix Applied:**
Added `lib/rate-limit.ts` implementing a sliding-window counter keyed on
client IP. Login is limited to 5 attempts per IP per 60 seconds.
```ts
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
const limit = rateLimit(`login:${ip}`, { limit: 5, windowMs: 60_000 })
if (!limit.success) {
  return NextResponse.json(
    { data: null, error: 'Too many login attempts. Try again in 1 minute.' },
    { status: 429, headers: { 'Retry-After': String(...) } }
  )
}
```

**Verification:**
```bash
for i in {1..6}; do
  curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.com","password":"wrong"}' | jq .error
done
# 6th response: "Too many login attempts. Try again in 1 minute."
```

---

### FINDING-002 — No CORS or Security Headers

| Field    | Detail                                  |
|----------|-----------------------------------------|
| Severity | HIGH                                    |
| File     | `next.config.ts`                        |
| Line     | 1–5 (entire file was empty config)      |
| Status   | ✅ Fixed                                |

**Vulnerability:**
`next.config.ts` was an empty config object. No CORS policy was set, meaning
any origin could make credentialed requests to the API. No security headers
were present, leaving the app vulnerable to clickjacking (no `X-Frame-Options`),
MIME sniffing attacks (no `X-Content-Type-Options`), and cross-site scripting
amplification (no `Content-Security-Policy`).

**Evidence:**
```ts
// Before
const nextConfig: NextConfig = {}
export default nextConfig
```

**Fix Applied:**
Added `headers()` to `next.config.ts` setting:
- `Access-Control-Allow-Origin` to `NEXT_PUBLIC_APP_URL` (not `*`)
- `Access-Control-Allow-Credentials: true`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Content-Security-Policy` restricting script/style/connect/img sources
- `Strict-Transport-Security` (production only)

**Verification:**
```bash
curl -H "Origin: https://evil.com" http://localhost:3000/api/repos -v 2>&1 \
  | grep "Access-Control-Allow-Origin"
# Must show the configured origin (localhost:3000), NOT evil.com
```

---

### FINDING-003 — GitHub URL Not Validated at Schema Level

| Field    | Detail                                                    |
|----------|------------------------------------------------------------|
| Severity | MEDIUM                                                    |
| File     | `lib/validators.ts`, line 14                              |
| Status   | ✅ Fixed                                                  |

**Vulnerability:**
`ConnectRepoSchema` only validated `z.string().url()`. The github.com domain
check was an ad-hoc `if (parsedUrl.hostname !== 'github.com')` in the route
handler after parsing. This meant the schema could be reused in other contexts
without the domain restriction, and the validation was split across two layers.
Additionally, paths like `https://github.com/owner` (missing repo segment)
passed the URL check and required a separate pathname segment count.

**Evidence:**
```ts
// Before
export const ConnectRepoSchema = z.object({
  url: z.string().url('Must be a valid URL'),
})
```

**Fix Applied:**
Consolidated all URL validation into the schema with a regex that enforces
the `github.com` domain and `owner/repo` path structure in one place:
```ts
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
```

**Verification:**
```bash
curl -s -X POST http://localhost:3000/api/repos/connect \
  -H "Content-Type: application/json" \
  -d '{"url":"https://gitlab.com/user/repo"}' | jq .
# Returns: { "data": null, "error": "URL must be a github.com repository..." }
```

---

### FINDING-004 — JWT_SECRET Minimum Length Not Enforced

| Field    | Detail                                   |
|----------|------------------------------------------|
| Severity | MEDIUM                                   |
| File     | `lib/auth.ts`, line 17                   |
| Status   | ✅ Fixed                                 |

**Vulnerability:**
`getSecret()` only checked that `JWT_SECRET` was set, not that it met the
32-character minimum required for HS256 to be resistant to brute force. A 1-
or 8-character secret would be accepted and used to sign all session tokens.

**Evidence:**
```ts
// Before
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  return new TextEncoder().encode(secret)
}
```

**Fix Applied:**
```ts
function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is not set')
  if (secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters')
  return new TextEncoder().encode(secret)
}
```

**Verification:**
Set `JWT_SECRET=short` in `.env`, start the dev server, and make any
authenticated request — the server will throw at startup/first use.

---

### FINDING-005 — Email Not Normalised to Lowercase

| Field    | Detail                                              |
|----------|-----------------------------------------------------|
| Severity | MEDIUM                                              |
| File     | `lib/validators.ts`, lines 4–7, 9–12               |
| Status   | ✅ Fixed                                            |

**Vulnerability:**
`RegisterSchema` and `LoginSchema` did not normalise email to lowercase before
DB operations. A user registering as `User@Example.com` would create a
different account than `user@example.com`, and logging in with either casing
would fail to find the other, causing account duplication and login failures.

**Evidence:**
```ts
// Before
email: z.string().email('Invalid email address'),
```

**Fix Applied:**
```ts
email: z
  .string()
  .email('Invalid email address')
  .max(255, 'Email too long')
  .transform((v) => v.toLowerCase().trim()),
```

**Verification:**
Register with `User@Example.COM`, then login with `user@example.com` — both
must refer to the same account.

---

### FINDING-006 — No Max Length Bounds on String Input Fields

| Field    | Detail                                              |
|----------|-----------------------------------------------------|
| Severity | MEDIUM                                              |
| File     | `lib/validators.ts`, all schemas                   |
| Status   | ✅ Fixed                                            |

**Vulnerability:**
Unbounded string fields (`email`, `password`, `url`) allowed arbitrarily large
payloads. A 10 MB password string would be hashed by bcrypt, causing a CPU-
exhaustion denial of service on the auth routes (bcrypt scales with input
length above 72 bytes, making very long inputs slow).

**Evidence:**
```ts
// Before — no upper bounds
password: z.string().min(8, 'Password must be at least 8 characters'),
url: z.string().url('Must be a valid URL'),
```

**Fix Applied:**
Added `.max()` to all string fields across all schemas:
```ts
password: z.string().min(8, '...').max(128, 'Password too long'),
email:    z.string().email().max(255, 'Email too long'),
url:      z.string().url().max(500, 'URL too long').regex(...),
```

**Verification:**
Send a POST to `/api/auth/login` with a 200-character email — must return 422.

---

### FINDING-007 — No Rate Limiting on Registration Endpoint

| Field    | Detail                                                    |
|----------|------------------------------------------------------------|
| Severity | MEDIUM                                                    |
| File     | `app/api/auth/register/route.ts`, line 11                 |
| Status   | ✅ Fixed                                                  |

**Vulnerability:**
`POST /api/auth/register` had no rate limiting. An attacker could create
thousands of accounts from a single IP, spamming the user table and exhausting
DB connections or disk space.

**Evidence:**
```ts
// Before — no guard at top of POST handler
export async function POST(req: NextRequest) {
  let body: unknown
  ...
}
```

**Fix Applied:**
```ts
const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
const limit = rateLimit(`register:${ip}`, { limit: 3, windowMs: 3_600_000 })
if (!limit.success) {
  return NextResponse.json(
    { data: null, error: 'Too many registration attempts. Try again in 1 hour.' },
    { status: 429, headers: { 'Retry-After': '...' } }
  )
}
```

**Verification:**
Send 4 POST requests to `/api/auth/register` from the same IP — the 4th must
return 429.

---

### FINDING-008 — Hardcoded Seed Password

| Field    | Detail                               |
|----------|--------------------------------------|
| Severity | LOW                                  |
| File     | `prisma/seed.ts`, line 83            |
| Status   | ✅ Fixed                             |

**Vulnerability:**
`password123` was hardcoded as the seed password. If seed data is accidentally
run against a staging environment, these well-known credentials would allow
anyone to log in to seed accounts.

**Evidence:**
```ts
// Before
const passwordHash = await bcrypt.hash('password123', 10);
```

**Fix Applied:**
```ts
// SEED DATA ONLY — never use these credentials in production
const seedPassword = process.env.SEED_PASSWORD ?? 'dev-only-seed-password'
const passwordHash = await bcrypt.hash(seedPassword, 10);
```

**Verification:**
Run `pnpm db:seed` — password is now sourced from `SEED_PASSWORD` env var,
falling back to `dev-only-seed-password` when unset (dev only).

---

### FINDING-009 — Fake GitHub Tokens in Seed Data Not Documented

| Field    | Detail                               |
|----------|--------------------------------------|
| Severity | LOW                                  |
| File     | `prisma/seed.ts`, lines 90, 98       |
| Status   | ⚠️ Deferred                         |

**Vulnerability:**
Seed data contains strings starting with `ghp_` (GitHub PAT prefix). While
these are intentionally fake, secret scanners (e.g. TruffleHog, GitHub push
protection) may flag them as real credentials, blocking CI or alerting the
security team unnecessarily.

**Deferred because:** The values are clearly not valid tokens (wrong length,
predictable content) and are already annotated with inline comments in this
audit pass. A proper fix requires either using a non-`ghp_` prefix for fake
tokens or adding a TruffleHog allowlist entry — scheduled post-launch.

---

## Fixes Applied (Summary)

| ID          | Title                               | File                                   | Change                          |
|-------------|-------------------------------------|----------------------------------------|---------------------------------|
| FINDING-001 | No rate limit on login              | `app/api/auth/login/route.ts`          | Added sliding-window rate limit |
| FINDING-002 | No CORS or security headers         | `next.config.ts`                       | Added full headers() block      |
| FINDING-003 | Weak GitHub URL validation          | `lib/validators.ts`                    | Added regex to ConnectRepoSchema|
| FINDING-004 | JWT_SECRET length not enforced      | `lib/auth.ts`                          | Added length check in getSecret |
| FINDING-005 | Email not normalised to lowercase   | `lib/validators.ts`                    | Added .transform() to schemas   |
| FINDING-006 | No max length on string fields      | `lib/validators.ts`                    | Added .max() to all schemas     |
| FINDING-007 | No rate limit on register           | `app/api/auth/register/route.ts`       | Added sliding-window rate limit |
| FINDING-008 | Hardcoded seed password             | `prisma/seed.ts`                       | Added SEED_PASSWORD env var     |
| (new)       | Rate limit implementation           | `lib/rate-limit.ts`                    | New file — sliding window store |

---

## Deferred Findings

- **FINDING-009**: Fake GitHub tokens in seed.ts use `ghp_` prefix — may trigger
  secret scanners. Deferred because values are non-functional and already
  annotated. Fix: use a TruffleHog allowlist or replace `ghp_` with `fake_`.
  Target: post-launch cleanup sprint.

---

## Recommendations

1. **Add OWASP ZAP scan to CI** — automated DAST scan on every PR catches
   injection and header issues that static analysis misses.

2. **Implement refresh token rotation** — current 7-day JWT sessions are long-
   lived. Rotating short-lived access tokens (15 min) + long-lived refresh
   tokens (7 days) limits exposure if a token is stolen.

3. **Add anomaly detection for GitHub token usage** — log when a stored
   `github_token` returns 401/403 from GitHub and alert the account owner;
   the token may have been rotated or revoked.

4. **Add account lockout on repeated failures** — complement the IP-based rate
   limit with a per-account lockout after N consecutive failures to protect
   accounts accessed from many IPs (distributed brute force).

5. **Schedule quarterly dependency audits** — run `pnpm audit` and review
   Dependabot PRs on a fixed cadence. The CI `security` job catches high+
   severities but moderate advisories should be reviewed on a schedule.
