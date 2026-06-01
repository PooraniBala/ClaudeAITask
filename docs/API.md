# DevPulse API Reference

**Base URL:** `http://localhost:3000/api`
**Auth:** All protected endpoints require a valid `devpulse_session` httpOnly cookie.
**Response shape:** All responses use `{ data, error, meta? }` envelope.

```ts
type ApiResponse<T> = {
  data: T | null
  error: string | null
  meta?: { page?: number; total?: number; cachedAt?: string }
}
```

**Error codes:**

| Code | Meaning           | When it occurs                                |
|------|-------------------|-----------------------------------------------|
| 400  | Bad Request       | Malformed JSON body                           |
| 401  | Unauthorized      | Missing, expired, or invalid session cookie   |
| 404  | Not Found         | Resource does not exist or belongs to another user |
| 409  | Conflict          | Duplicate resource (email already registered, repo already connected) |
| 422  | Validation Error  | Zod schema validation failed                  |
| 429  | Rate Limited      | Too many requests — check `Retry-After` header |
| 500  | Server Error      | Unexpected internal error                     |

---

## Auth Endpoints

### POST /api/auth/register

Create a new user account. Sets a session cookie on success.

**Auth required:** No
**Rate limit:** 3 requests / hour per IP

**Request body:**
```json
{
  "email": "alice@devpulse.dev",
  "password": "securepassword123"
}
```

**Validation rules:**
- `email`: valid email format, normalised to lowercase, max 255 chars
- `password`: min 8 characters, max 128 chars

**Success response (201):**
```json
{
  "data": {
    "id": "clx1abc123",
    "email": "alice@devpulse.dev"
  },
  "error": null
}
```
Sets cookie: `devpulse_session` (httpOnly, Secure in production, SameSite=Strict)

**Error responses:**
- `409` — `{ "data": null, "error": "Already exists" }`
- `422` — `{ "data": null, "error": "Invalid email address" }`
- `429` — `{ "data": null, "error": "Too many registration attempts. Try again in 1 hour." }`

**curl example:**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@devpulse.dev","password":"securepassword123"}' \
  -c cookies.txt | jq .
```

---

### POST /api/auth/login

Authenticate with email and password. Sets a session cookie on success.

**Auth required:** No
**Rate limit:** 5 requests / minute per IP

**Request body:**
```json
{
  "email": "alice@devpulse.dev",
  "password": "securepassword123"
}
```

**Success response (200):**
```json
{
  "data": { "id": "clx1abc123", "email": "alice@devpulse.dev" },
  "error": null
}
```
Sets cookie: `devpulse_session` (httpOnly, Secure in production, SameSite=Strict)

**Error responses:**
- `401` — `{ "data": null, "error": "Invalid credentials" }`
- `422` — `{ "data": null, "error": "Invalid email address" }`
- `429` — `{ "data": null, "error": "Too many login attempts. Try again in 1 minute." }`
  - Includes header: `Retry-After: <seconds>`

**curl example:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@devpulse.dev","password":"securepassword123"}' \
  -c cookies.txt | jq .
```

---

### DELETE /api/auth/logout

End the current session. Deletes the session record from the database and clears the cookie.

**Auth required:** Yes

**Success response (200):**
```json
{
  "data": { "message": "Logged out" },
  "error": null
}
```
Clears cookie: `devpulse_session`

**Error responses:**
- `401` — `{ "data": null, "error": "Unauthorized" }`

**curl example:**
```bash
curl -X DELETE http://localhost:3000/api/auth/logout \
  -b cookies.txt | jq .
```

---

### GET /api/auth/session

Return the currently authenticated user and session ID.

**Auth required:** Yes

**Success response (200):**
```json
{
  "data": {
    "id": "clx1abc123",
    "email": "alice@devpulse.dev",
    "sessionId": "clx2def456"
  },
  "error": null
}
```

**Error responses:**
- `401` — `{ "data": null, "error": "Unauthorized" }`

**curl example:**
```bash
curl http://localhost:3000/api/auth/session -b cookies.txt | jq .
```

---

## Repository Endpoints

### GET /api/repos

List all repositories connected by the authenticated user.

**Auth required:** Yes

**Success response (200):**
```json
{
  "data": [
    {
      "id": "clx3ghi789",
      "githubId": 123456789,
      "name": "devpulse",
      "fullName": "alice/devpulse",
      "url": "https://github.com/alice/devpulse",
      "isPrivate": false,
      "lastSyncedAt": "2026-06-01T10:00:00.000Z",
      "createdAt": "2026-05-01T10:00:00.000Z"
    }
  ],
  "error": null,
  "meta": { "total": 1 }
}
```

**Error responses:**
- `401` — `{ "data": null, "error": "Unauthorized" }`

**curl example:**
```bash
curl http://localhost:3000/api/repos -b cookies.txt | jq .
```

---

### POST /api/repos/connect

Connect a GitHub repository. Fetches metadata via the GitHub MCP server and triggers an initial metric sync.

**Auth required:** Yes

**Request body:**
```json
{
  "url": "https://github.com/alice/devpulse"
}
```

**Validation rules:**
- `url`: must match `https://github.com/{owner}/{repo}` exactly
- Repo must be accessible with the server's `GITHUB_TOKEN`

**Success response (201):**
```json
{
  "data": {
    "id": "clx3ghi789",
    "githubId": 123456789,
    "name": "devpulse",
    "fullName": "alice/devpulse",
    "url": "https://github.com/alice/devpulse",
    "isPrivate": false,
    "lastSyncedAt": "2026-06-01T10:00:00.000Z",
    "createdAt": "2026-06-01T10:00:00.000Z"
  },
  "error": null
}
```

**Error responses:**
- `401` — `{ "data": null, "error": "Unauthorized" }`
- `404` — `{ "data": null, "error": "Repository not found or access denied" }`
- `422` — `{ "data": null, "error": "URL must be a github.com repository (https://github.com/owner/repo)" }`
- `429` — `{ "data": null, "error": "GitHub rate limit exceeded", "meta": { "retryAfter": 3600 } }`

**curl example:**
```bash
curl -X POST http://localhost:3000/api/repos/connect \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"url":"https://github.com/alice/devpulse"}' | jq .
```

---

### POST /api/repos/:repoId/sync

Force a metric sync for a specific repository. Fetches fresh data from GitHub and upserts into the database.

**Auth required:** Yes

**Query params:**
- `period`: `"7d"` | `"30d"` | `"90d"` (optional, default `"30d"`)

**Success response (200):**
```json
{
  "data": {
    "synced": true,
    "lastSyncedAt": "2026-06-01T10:05:00.000Z"
  },
  "error": null
}
```

**Error responses:**
- `401` — `{ "data": null, "error": "Unauthorized" }`
- `404` — `{ "data": null, "error": "Not found" }`
- `429` — `{ "data": null, "error": "GitHub rate limit exceeded", "meta": { "retryAfter": 3600 } }`

**curl example:**
```bash
curl -X POST "http://localhost:3000/api/repos/clx3ghi789/sync?period=30d" \
  -b cookies.txt | jq .
```

---

## Metrics Endpoints

### GET /api/metrics/:repoId

Get metric records for a specific repository. Auto-syncs from GitHub if data is stale (> 1 hour) or missing.

**Auth required:** Yes

**Query params:**
- `period`: `"7d"` | `"30d"` | `"90d"` (optional, default `"30d"`)

**Success response (200):**
```json
{
  "data": [
    {
      "id": "clx4jkl012",
      "repoId": "clx3ghi789",
      "type": "COMMIT_FREQUENCY",
      "period": "THIRTY_DAYS",
      "payload": {
        "weeks": [
          { "week": "2026-05-01", "count": 12 },
          { "week": "2026-05-08", "count": 8 }
        ],
        "total_days": 30
      },
      "recordedAt": "2026-06-01T10:00:00.000Z"
    },
    {
      "id": "clx5mno345",
      "repoId": "clx3ghi789",
      "type": "PR_STATS",
      "period": "THIRTY_DAYS",
      "payload": {
        "opened": 25,
        "merged": 10,
        "closed": 3,
        "avg_merge_time_hours": 18.5,
        "total_days": 30
      },
      "recordedAt": "2026-06-01T10:00:00.000Z"
    },
    {
      "id": "clx6pqr678",
      "repoId": "clx3ghi789",
      "type": "CONTRIBUTOR_ACTIVITY",
      "period": "THIRTY_DAYS",
      "payload": {
        "contributors": [
          {
            "login": "alice",
            "commits": 45,
            "additions": 1200,
            "deletions": 340
          }
        ],
        "total_days": 30
      },
      "recordedAt": "2026-06-01T10:00:00.000Z"
    }
  ],
  "error": null,
  "meta": { "total": 3, "synced": true }
}
```

**Metric types:**

| Type                  | Payload shape                                              |
|-----------------------|------------------------------------------------------------|
| `COMMIT_FREQUENCY`    | `{ weeks: [{week, count}], total_days }`                   |
| `PR_STATS`            | `{ opened, merged, closed, avg_merge_time_hours, total_days }` |
| `CONTRIBUTOR_ACTIVITY`| `{ contributors: [{login, commits, additions, deletions}], total_days }` |

**Error responses:**
- `401` — `{ "data": null, "error": "Unauthorized" }`
- `404` — `{ "data": null, "error": "Not found" }`
- `422` — `{ "data": null, "error": "Invalid enum value..." }` (invalid period)

**curl example:**
```bash
curl "http://localhost:3000/api/metrics/clx3ghi789?period=30d" \
  -b cookies.txt | jq .
```

---

## Dashboard Endpoint

### GET /api/dashboard

Return aggregated metrics across all of the authenticated user's repositories for the last 30 days.

**Auth required:** Yes

**Success response (200):**
```json
{
  "data": {
    "totalCommits": 234,
    "openPrs": 8,
    "repoCount": 3,
    "topContributor": "alice",
    "repos": [
      {
        "id": "clx3ghi789",
        "fullName": "alice/devpulse",
        "latestMetrics": [
          {
            "id": "clx4jkl012",
            "repoId": "clx3ghi789",
            "type": "COMMIT_FREQUENCY",
            "period": "THIRTY_DAYS",
            "payload": { "weeks": [...], "total_days": 30 },
            "recordedAt": "2026-06-01T10:00:00.000Z"
          }
        ]
      }
    ]
  },
  "error": null
}
```

**Error responses:**
- `401` — `{ "data": null, "error": "Unauthorized" }`

**curl example:**
```bash
curl http://localhost:3000/api/dashboard -b cookies.txt | jq .
```

---

## Settings Endpoint

### PATCH /api/settings

Update the GitHub Personal Access Token stored for the authenticated user.

**Auth required:** Yes

**Request body:**
```json
{
  "githubToken": "ghp_your_personal_access_token"
}
```

**Validation rules:**
- `githubToken`: non-empty string, min 1 char

**Success response (200):**
```json
{
  "data": { "id": "clx1abc123", "email": "alice@devpulse.dev" },
  "error": null
}
```

**Error responses:**
- `401` — `{ "data": null, "error": "Unauthorized" }`
- `422` — `{ "data": null, "error": "Token is required" }`

**curl example:**
```bash
curl -X PATCH http://localhost:3000/api/settings \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"githubToken":"ghp_your_token_here"}' | jq .
```

---

## Complete Endpoint Reference

| Method   | Endpoint                       | Auth | Rate Limit           |
|----------|--------------------------------|------|----------------------|
| `POST`   | `/api/auth/register`           | No   | 3 / hour / IP        |
| `POST`   | `/api/auth/login`              | No   | 5 / minute / IP      |
| `DELETE` | `/api/auth/logout`             | Yes  | —                    |
| `GET`    | `/api/auth/session`            | Yes  | —                    |
| `GET`    | `/api/repos`                   | Yes  | —                    |
| `POST`   | `/api/repos/connect`           | Yes  | —                    |
| `POST`   | `/api/repos/:repoId/sync`      | Yes  | GitHub: 5000 req/hr  |
| `GET`    | `/api/metrics/:repoId`         | Yes  | GitHub: 5000 req/hr  |
| `GET`    | `/api/dashboard`               | Yes  | —                    |
| `PATCH`  | `/api/settings`                | Yes  | —                    |
