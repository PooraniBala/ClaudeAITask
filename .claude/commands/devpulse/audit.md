Run a full security audit checklist against the DevPulse codebase

## What This Does
Executes a structured security checklist across all API routes, auth helpers,
config files, and environment setup. Appends findings to docs/SECURITY-AUDIT.md
under a new dated run section.

## Arguments
- $SCOPE (optional): "quick" checks auth + validation only; "full" checks everything
  Default: "full"

## Steps

1. Run automated dependency vulnerability scan:
   Run: pnpm audit --audit-level=high
   - If vulnerabilities found: list each with package name, severity, and fix command
   - If clean: print "✅ No high/critical dependency vulnerabilities"

2. Scan for hardcoded secrets in source files:
   Run: grep -rn "password\|secret\|token\|api_key\|apikey\|private_key" \
     --include="*.ts" --include="*.tsx" \
     --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=coverage \
     --exclude="*.test.*" --exclude="*.spec.*" \
     --exclude=".env.example" .
   - Flag any match that assigns a literal string value (not process.env.*)
   - Ignore prisma/seed.ts lines already marked "SEED DATA ONLY" or "Fake token"
   - Flag test files containing real-looking credentials (not obvious test stubs)

3. Check every route file in app/api/ for:
   □ requireAuth() called before any business logic or DB query
   □ Resource ownership verified (repo.owner_id === session.userId or equivalent)
   □ Request body parsed through a Zod schema before DB access
   □ Response payload contains no password_hash, raw token, or JWT string

4. Check authentication configuration:
   □ lib/auth.ts — getSecret() throws if JWT_SECRET is missing or < 32 chars
   □ lib/cookies.ts — httpOnly: true, sameSite: 'strict', secure: true in production
   □ middleware.ts — dashboard routes redirect to /login when no valid session

5. Check rate limiting:
   □ app/api/auth/login/route.ts imports and calls rateLimit()
   □ app/api/auth/register/route.ts imports and calls rateLimit()
   □ lib/rate-limit.ts exists and exports a rateLimit function

6. Check CORS and security headers in next.config.ts:
   □ Access-Control-Allow-Origin is not "*"
   □ X-Frame-Options: DENY is present
   □ X-Content-Type-Options: nosniff is present
   □ Content-Security-Policy header is present
   □ Referrer-Policy is present

7. Check environment hygiene:
   □ .gitignore includes .env and .env.local
   □ .env.example contains only placeholder values (no real tokens or passwords)
   □ No .env file (other than .env.example) is tracked by git:
     Run: git ls-files | grep -E "^\.env"
     Only .env.example should appear

8. For each finding discovered in steps 1-7:
   - Assign severity: CRITICAL / HIGH / MEDIUM / LOW
   - Record: file path, line number, description, recommended fix
   - Append a new dated section to docs/SECURITY-AUDIT.md:
     ## Audit Run — <today's date>
     | Severity | File | Finding | Status |
     ...

9. Print final summary:
   🔒 Security Audit Complete
   ━━━━━━━━━━━━━━━━━━━━━━━━━
   ✅ Passed: N checks
   ⚠️  Warnings: N findings (MEDIUM/LOW)
   ❌ Failed: N findings (CRITICAL/HIGH)

   Full report: docs/SECURITY-AUDIT.md

   If any CRITICAL or HIGH findings exist, also print:
   ❌ ACTION REQUIRED — fix all CRITICAL and HIGH findings before shipping

## Success Criteria
- docs/SECURITY-AUDIT.md updated with a section dated today
- Zero CRITICAL findings
- Zero HIGH findings
- pnpm audit exits 0 (no high/critical dependency vulnerabilities)
- All checklist items in steps 3-7 pass
