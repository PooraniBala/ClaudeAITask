# DevPulse — Developer Analytics Dashboard

## 1. Project Description

DevPulse connects to GitHub repositories and surfaces engineering insights: commit frequency, pull request stats, code review throughput, and team activity over time. It gives engineering leads a single view of development health across multiple repos without leaving the browser.

Data flows from GitHub (via the GitHub MCP server) → API routes → PostgreSQL (via Prisma) → React dashboards built with Recharts.

---

## 2. Architecture Overview

```
devpulse/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # overview / home
│   │   ├── repos/
│   │   │   ├── page.tsx              # repo list
│   │   │   └── [repoId]/
│   │   │       └── page.tsx          # per-repo detail
│   │   └── team/
│   │       └── page.tsx
│   └── api/
│       ├── auth/
│       │   ├── login/route.ts
│       │   └── register/route.ts
│       ├── repos/
│       │   └── route.ts              # GET list, POST add
│       ├── metrics/
│       │   └── [repoId]/
│       │       └── route.ts          # GET commit/PR metrics
│       └── dashboard/
│           └── route.ts              # GET aggregated summary
├── components/
│   ├── charts/
│   │   ├── CommitFrequencyChart.tsx
│   │   ├── PRThroughputChart.tsx
│   │   └── TeamActivityHeatmap.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Badge.tsx
│   │   └── Skeleton.tsx
│   └── layout/
│       ├── Sidebar.tsx
│       ├── Topbar.tsx
│       └── PageShell.tsx
├── lib/
│   ├── prisma.ts                     # singleton PrismaClient
│   ├── github.ts                     # GitHub MCP client helpers
│   ├── auth.ts                       # JWT sign / verify helpers
│   └── validators.ts                 # Zod schemas for API payloads
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── __tests__/
│   ├── lib/
│   ├── api/
│   └── components/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── preview.yml
└── .claude/
    ├── settings.json
    └── commands/
        ├── devpulse-seed.md
        ├── devpulse-audit.md
        └── devpulse-coverage.md
```

---

## 3. Stack

| Layer       | Technology                                      |
|-------------|------------------------------------------------|
| Frontend    | Next.js 15 (App Router, React Server Components) |
| Styling     | Tailwind CSS v4                                 |
| Charts      | Recharts 2                                      |
| ORM         | Prisma 5                                        |
| Database    | PostgreSQL 16                                   |
| Auth        | JWT (jose) — access + refresh token pair        |
| MCP         | GitHub MCP server (official Anthropic connector) |
| Testing     | Vitest, React Testing Library, Supertest        |
| CI/CD       | GitHub Actions                                  |

---

## 4. Coding Conventions

### Naming

- **Files and folders:** kebab-case everywhere (`commit-frequency-chart.tsx`, `use-repo-metrics.ts`). Exception: Prisma migration folders (auto-generated).
- **Components:** PascalCase named exports only — no default exports.
  ```ts
  // correct
  export function CommitFrequencyChart({ data }: Props) { ... }
  ```
- **Hooks:** `use` prefix, camelCase (`useRepoMetrics`, `useAuth`).
- **API route handlers:** Follow Next.js convention — exported named functions matching HTTP verbs (`GET`, `POST`, `PATCH`, `DELETE`) inside `route.ts`.
  ```ts
  export async function GET(req: Request) { ... }
  ```

### TypeScript

- `strict: true` in `tsconfig.json` — no exceptions.
- `any` is banned. Use `unknown` and narrow, or define a proper type.
- All functions (including React components) must have explicit return types.
- Prefer `type` over `interface` for plain data shapes; use `interface` only for objects expected to be extended.

### Tailwind

- Use the `cn()` utility (from `clsx` + `tailwind-merge`) for any conditional class logic — never string concatenation or ternaries inside `className`.
- No inline `style` props. If a value cannot be expressed with Tailwind utilities, add a CSS variable in `globals.css`.
- Mobile-first: write base styles for small screens, layer up with `md:` / `lg:`.

### API Response Shape

All API routes return a consistent envelope:

```ts
type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  meta?: {
    page?: number;
    total?: number;
    cachedAt?: string;
  };
};
```

Success responses set `error: null`; error responses set `data: null` and include a human-readable `error` string.

### Comments

Write comments only when the **why** is non-obvious — a hidden constraint, a rate-limit workaround, a GitHub API quirk. Do not describe what the code does; well-named identifiers already do that.

---

## 5. Testing Strategy

**Coverage target:** 80 %+ across statements, branches, and functions. CI fails below this threshold.

| Layer              | Tool                       | What to test                                                        |
|--------------------|----------------------------|---------------------------------------------------------------------|
| `lib/`             | Vitest (unit)              | Auth helpers, validators, GitHub client response parsing            |
| `app/api/`         | Vitest + Supertest (integration) | Full request/response cycle against a real test database      |
| `components/`      | React Testing Library      | Render, user interactions, loading/error states                     |

**Edge cases that must have explicit test coverage:**

- Empty repositories (no commits, no PRs)
- GitHub API rate-limit responses (403 + `Retry-After` header)
- Expired or tampered JWT sessions
- Repos the authenticated user no longer has access to

**Snapshot tests are prohibited.** They couple tests to markup structure and generate noise on every UI tweak. Use explicit assertions on rendered text, roles, and data attributes instead.

**Test database:** Integration tests run against a dedicated `devpulse_test` PostgreSQL database, seeded via `prisma/seed.ts` before each suite and torn down after. Never point tests at the development or production database.

---

## 6. Scope Boundaries

The following features are **out of scope** for this project. Do not implement or design toward them.

| Feature                        | Reason out of scope                                                    |
|--------------------------------|------------------------------------------------------------------------|
| GitLab / Bitbucket integration | Only the GitHub MCP server is available; multi-VCS adds unscoped complexity |
| WebSockets / live push         | Polling on dashboard load is sufficient; real-time infra adds ops burden |
| Team management & invites      | User model is single-tenant; org/invite flows require a separate auth layer |
| Billing & usage limits         | No monetization in this version                                        |
| Mobile native app              | Responsive web covers mobile; a native app is a separate project       |
| AI PR summaries                | Out of model scope; would require a separate LLM integration           |
| Webhook ingestion              | GitHub MCP server pulls data on demand; inbound webhooks add infra complexity |
| Multi-tenant data isolation    | Each deployment serves one team; row-level security is not implemented |

---

## 7. Claude Code Usage

### Plan Mode

Before implementing any feature that touches the database schema, API contract, or auth flow, enter plan mode first:

```
/plan
```

Describe the feature, list the files that will change, and identify any migrations needed. Get the plan confirmed before writing code. This prevents schema drift and keeps migrations reviewable.

### Custom Commands (.claude/commands/)

| Command            | File                                  | What It Does                                    |
|--------------------|---------------------------------------|-------------------------------------------------|
| `/devpulse:seed`   | `.claude/commands/devpulse/seed.md`   | Reset DB and re-seed with sample data           |
| `/devpulse:audit`  | `.claude/commands/devpulse/audit.md`  | Full security audit + update SECURITY-AUDIT.md  |
| `/devpulse:coverage` | `.claude/commands/devpulse/coverage.md` | Run tests with coverage + open HTML report  |

Run any command by typing its slash command in the Claude Code CLI.

**`/devpulse:seed`**
Drops all data, re-runs all Prisma migrations, and seeds 2 users, 6 repos, and 18+ metric records. Use this after a schema change or when the local DB gets into a bad state. Refuses to run outside `NODE_ENV=development`.

**`/devpulse:audit`**
Runs a structured security checklist: `pnpm audit`, hardcoded-secret grep, per-route auth/ownership/validation checks, cookie flags, rate-limit presence, CORS headers, and env hygiene. Appends findings to `docs/SECURITY-AUDIT.md`. Accepts `$SCOPE=quick` for auth+validation only.

**`/devpulse:coverage`**
Runs `vitest run --coverage` (Istanbul provider, thresholds in `vitest.config.ts`), prints a per-layer summary table, lists any files below the 90%/85% threshold with specific uncovered line ranges, and opens the HTML report. Use this before marking a task done.

### Prompt Style (CRISP)

When asking Claude Code to implement something, be explicit about:

- **C**ontext — which file or layer is affected
- **R**equirement — what it must do
- **I**nput/Output — the shape of data going in and coming out
- **S**cope — what is and is not changing
- **P**recedent — a nearby file that should be used as a style reference

Example:
> In `app/api/metrics/[repoId]/route.ts`, add a `GET` handler that fetches commit counts grouped by week for the past 12 weeks. Input: `repoId` path param + JWT from cookie. Output: `ApiResponse<{ week: string; count: number }[]>`. Do not change the schema. Follow the pattern in `app/api/repos/route.ts`.

Vague prompts ("add metrics") produce vague code. CRISP prompts produce reviewable code.

---

## 8. MCP Integration

### Server
GitHub MCP server (`@modelcontextprotocol/server-github`)
Configured in `.mcp.json` at project root.

### What It Enables
- Fetches repo metadata on connect (replaces direct REST calls)
- Pulls commit frequency, PR stats, contributor data per repo per period
- Handles GitHub API pagination automatically

### Where MCP Is Used
| Feature                  | File                                      | MCP Function              |
|--------------------------|-------------------------------------------|---------------------------|
| Connect repo             | `app/api/repos/connect/route.ts`          | fetchRepoMetadata         |
| Sync metrics on connect  | `lib/sync.ts`                             | fetchCommitFrequency      |
| Sync metrics on demand   | `app/api/repos/[repoId]/sync/route.ts`    | fetchPrStats              |
| Activity feed data       | `app/api/metrics/[repoId]/route.ts`       | fetchContributors         |

### Sync Strategy
On-demand fetch → transform → upsert into Metric table.
Metrics are re-synced if `lastSyncedAt > 1 hour ago` or no records exist for the requested period.

### Rate Limiting
`McpError RATE_LIMITED` is surfaced to the UI with a `retryAfter` countdown.
Never retry automatically — always surface to the user.

### Environment Variables
`GITHUB_TOKEN` — GitHub Personal Access Token
Required scopes: `repo`, `read:user`, `read:org`
