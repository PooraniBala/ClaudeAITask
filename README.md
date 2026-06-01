# DevPulse — Developer Analytics Dashboard

![CI](https://github.com/PooraniBala/ClaudeAITask/actions/workflows/ci.yml/badge.svg)
![Coverage](https://img.shields.io/badge/coverage-90%25-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

> Track your team's GitHub activity — commit frequency, PR stats, and
> contributor trends — without manual reporting.

## Table of Contents
- [Quick Start](#quick-start)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running Tests](#running-tests)
- [Custom Commands](#custom-commands)
- [API Reference](#api-reference)
- [Security](#security)
- [Contributing](#contributing)

---

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- PostgreSQL 16+ running locally
- GitHub Personal Access Token (scopes: `repo`, `read:user`, `read:org`)

### 1. Clone and install
```bash
git clone https://github.com/PooraniBala/ClaudeAITask.git
cd ClaudeAITask
pnpm install
```

### 2. Configure environment
```bash
cp .env.example .env.local
# Edit .env.local and fill in:
# DATABASE_URL  — your local PostgreSQL connection string
# JWT_SECRET    — any random string of 32+ characters
# GITHUB_TOKEN  — your GitHub PAT
# NEXT_PUBLIC_APP_URL — http://localhost:3000
```

### 3. Set up database
```bash
pnpm db:migrate   # applies all migrations
pnpm db:seed      # seeds 2 users, 6 repos, 18+ metric records
```

### 4. Start the app
```bash
pnpm dev
# Open http://localhost:3000
```

### 5. Log in with seed credentials
```
Email:    alice@devpulse.dev
Password: dev-only-seed-password
```
(Override the seed password by setting `SEED_PASSWORD` in `.env.local` before seeding.)

⏱ Total time: ~4 minutes

---

## Features

- 📊 Commit frequency charts by repo and time range (7d / 30d / 90d)
- 🔀 Pull request stats — open, closed, merged, avg merge time
- 👥 Contributor activity rankings
- 🔗 Connect any GitHub repo by URL
- 🔄 On-demand metric sync via GitHub MCP server (auto-refreshes after 1 hour)
- 🔐 JWT authentication with httpOnly, SameSite=Strict cookie sessions
- 📱 Responsive — mobile-first Tailwind CSS

---

## Architecture

```
GitHub MCP Server
      │  fetchRepoMetadata / fetchCommitFrequency / fetchPrStats / fetchContributors
      ▼
lib/github.ts + lib/sync.ts
      │  upsert
      ▼
PostgreSQL (via Prisma)
      │  query
      ▼
Next.js API Routes  (app/api/)
      │  { data, error, meta? }
      ▼
React Components  (SWR fetch)
      │  render
      ▼
Dashboard UI  (Recharts + Tailwind CSS)
```

**Authentication flow:**
```
POST /api/auth/login
  → bcrypt.compare(password, hash)
  → signJwt(payload)          — lib/auth.ts
  → Session row created       — PostgreSQL
  → httpOnly cookie set       — lib/cookies.ts
  → middleware.ts             — verifies cookie on every page request
  → requireAuth()             — guards every API route handler
```

---

## Tech Stack

| Layer      | Technology                            |
|------------|---------------------------------------|
| Frontend   | Next.js 15 (App Router), TypeScript   |
| Styling    | Tailwind CSS v4 + clsx + tailwind-merge |
| Charts     | Recharts                              |
| Data Fetch | SWR                                   |
| ORM        | Prisma 5                              |
| Database   | PostgreSQL 16                         |
| Auth       | JWT (jose) + httpOnly cookies         |
| MCP        | GitHub MCP server                     |
| Testing    | Vitest + React Testing Library        |
| CI/CD      | GitHub Actions                        |

---

## Project Structure

```
devpulse/
├── app/
│   ├── (auth)/              # login, register pages
│   ├── (dashboard)/         # protected dashboard pages
│   │   ├── page.tsx         # main dashboard
│   │   ├── repos/           # repo list + connect
│   │   └── settings/        # user preferences
│   └── api/                 # API route handlers
│       ├── auth/            # register, login, logout, session
│       ├── repos/           # list, connect, [repoId]/sync
│       ├── metrics/         # [repoId]?period=
│       ├── dashboard/       # aggregated summary
│       └── settings/        # update GitHub token
├── components/
│   ├── charts/              # MetricsChart, StatCard
│   ├── dashboard/           # ActivityFeed, RepoSelector, TimeRangeFilter
│   ├── layout/              # Navbar, Sidebar, PageShell
│   └── ui/                  # Button, Card, Badge, Spinner, ErrorBoundary
├── lib/
│   ├── auth.ts              # JWT sign/verify, session management
│   ├── cookies.ts           # httpOnly cookie helpers
│   ├── github.ts            # GitHub API client (MCP functions)
│   ├── rate-limit.ts        # IP-based sliding-window rate limiter
│   ├── sync.ts              # MCP → DB sync orchestration
│   ├── types.ts             # shared TypeScript types
│   ├── utils.ts             # cn() and fetcher helpers
│   └── validators.ts        # Zod schemas for all API inputs
├── prisma/
│   ├── schema.prisma        # User, Repository, Metric, Session models
│   ├── migrations/          # versioned migration history
│   └── seed.ts              # realistic sample data (2 users, 6 repos)
├── __tests__/               # Vitest test suite (90%+ coverage)
├── .claude/commands/        # Claude Code custom commands
├── .github/workflows/       # CI/CD pipeline (lint, test, build, security)
└── docs/
    ├── API.md               # full endpoint reference
    └── SECURITY-AUDIT.md    # audit report with all findings and fixes
```

---

## Environment Variables

See `.env.example` for the full list with descriptions.

| Variable             | Required | Description                               |
|----------------------|----------|-------------------------------------------|
| `DATABASE_URL`       | ✅       | PostgreSQL connection string              |
| `JWT_SECRET`         | ✅       | Min 32 chars — signs all session tokens   |
| `GITHUB_TOKEN`       | ✅       | PAT with `repo`, `read:user`, `read:org`  |
| `NEXT_PUBLIC_APP_URL`| ✅       | App base URL (e.g. `http://localhost:3000`)|
| `NODE_ENV`           | ✅       | `development` / `test` / `production`     |
| `SEED_PASSWORD`      | ❌       | Seed user password (default: `dev-only-seed-password`) |

---

## Database Setup

```bash
pnpm db:migrate   # apply all pending migrations (dev)
pnpm db:deploy    # apply migrations non-interactively (CI / production)
pnpm db:seed      # seed sample data (2 users, 6 repos, 18+ metrics)
pnpm db:reset     # wipe + re-migrate + re-seed (dev only)
pnpm db:studio    # open Prisma Studio at http://localhost:5555
```

**Schema:** 4 tables — `User`, `Repository`, `Metric`, `Session`
See `prisma/schema.prisma` for full model definitions.

---

## Running Tests

```bash
pnpm test             # run all tests (no coverage)
pnpm test:coverage    # run with coverage report (enforces thresholds)
pnpm test:watch       # watch mode for development
```

**Coverage thresholds (enforced in CI via `vitest.config.ts`):**

| Metric     | Threshold |
|------------|-----------|
| Statements | 90%+      |
| Functions  | 90%+      |
| Lines      | 90%+      |
| Branches   | 85%+      |

---

## Custom Commands

Run these in the Claude Code CLI:

| Command              | Description                                         |
|----------------------|-----------------------------------------------------|
| `/devpulse:seed`     | Reset DB and re-seed with sample data               |
| `/devpulse:audit`    | Run full security audit, update SECURITY-AUDIT.md   |
| `/devpulse:coverage` | Run tests with coverage + open HTML report          |

Command files live in `.claude/commands/devpulse/`.

---

## API Reference

Full endpoint documentation: [docs/API.md](docs/API.md)

**Base URL:** `http://localhost:3000/api`
**Auth:** JWT via httpOnly cookie (`devpulse_session`)
**Response shape:** `{ data, error, meta? }`

| Method   | Endpoint                      | Auth | Description              |
|----------|-------------------------------|------|--------------------------|
| `POST`   | `/api/auth/register`          | No   | Create account           |
| `POST`   | `/api/auth/login`             | No   | Sign in                  |
| `DELETE` | `/api/auth/logout`            | Yes  | Sign out                 |
| `GET`    | `/api/auth/session`           | Yes  | Get current user         |
| `GET`    | `/api/repos`                  | Yes  | List connected repos     |
| `POST`   | `/api/repos/connect`          | Yes  | Connect a GitHub repo    |
| `POST`   | `/api/repos/:repoId/sync`     | Yes  | Force metric sync        |
| `GET`    | `/api/metrics/:repoId`        | Yes  | Get repo metrics         |
| `GET`    | `/api/dashboard`              | Yes  | Aggregated summary       |
| `PATCH`  | `/api/settings`               | Yes  | Update GitHub token      |

---

## Security

- JWT stored in `httpOnly`, `Secure`, `SameSite=Strict` cookies
- Rate limiting: 5 login attempts/min, 3 registrations/hour per IP
- All inputs validated with Zod before any DB access
- Prisma ORM only — no raw SQL, no injection surface
- CORS restricted to `NEXT_PUBLIC_APP_URL` (never `*`)
- Security headers: `X-Frame-Options: DENY`, CSP, HSTS (production), `nosniff`, `Referrer-Policy`
- Full audit report: [docs/SECURITY-AUDIT.md](docs/SECURITY-AUDIT.md)

---

## Contributing

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Follow conventions in [CLAUDE.md](CLAUDE.md)
3. Write tests for every change — maintain 90%+ coverage
4. Open a PR to `main` — all CI checks must pass before merge
5. Use semantic PR titles: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `ci:`
