# DevPulse — Developer Analytics Dashboard

![CI](https://github.com/PooraniBala/ClaudeAITask/actions/workflows/ci.yml/badge.svg)

DevPulse connects to GitHub repositories and surfaces engineering insights: commit frequency, pull request stats, code review throughput, and team activity over time.

## Stack

- **Frontend:** Next.js 15 (App Router), React 19, Tailwind CSS v4, Recharts
- **Backend:** Next.js API Routes, Prisma 5, PostgreSQL 16
- **Auth:** JWT via jose (access + refresh token pair)
- **MCP:** GitHub MCP server
- **Testing:** Vitest, React Testing Library

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Run database migrations
pnpm db:migrate

# Start dev server
pnpm dev
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start development server |
| `pnpm build` | Production build |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | TypeScript type check |
| `pnpm test` | Run tests |
| `pnpm test:coverage` | Run tests with coverage report |
| `pnpm db:migrate` | Run Prisma migrations (dev) |
| `pnpm db:deploy` | Run Prisma migrations (prod/CI) |
| `pnpm db:seed` | Seed the database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm audit` | Security audit (high+ severity) |

## CI Pipeline

Every PR and push to `main` runs four jobs in sequence:

1. **Lint & Type Check** — ESLint + `tsc --noEmit`
2. **Unit & Integration Tests** — Vitest with 90%+ coverage threshold
3. **Production Build** — `next build` with Prisma client generation
4. **Security Audit** — `pnpm audit` + TruffleHog secrets scan

See [`.github/branch-protection.md`](.github/branch-protection.md) for required branch protection settings.
