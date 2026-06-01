Reset and re-seed the local DevPulse database with fresh sample data

## What This Does
Drops all existing data, re-runs migrations, and seeds realistic sample
data so you have a clean local environment to develop against.

## Steps

1. Confirm the current NODE_ENV is development — refuse to run in production:
   - Read the value of process.env.NODE_ENV from the shell environment
   - If it is not "development", print:
     ⛔ Refused: /devpulse:seed only runs in NODE_ENV=development
     and stop immediately without running any further commands

2. Reset the database (drops all data, re-applies all migrations):
   Run: npx prisma migrate reset --force
   - This drops all tables and recreates them from the migration history
   - Watch for errors — if the command fails, print the error and stop

3. Run the seed file:
   Run: npx prisma db seed
   Confirm the output contains lines like:
   - "Seed complete"
   - user count, repo count, metric count, session count

4. Verify row counts by querying the DB directly:
   Run: npx prisma db execute --stdin <<'SQL'
   SELECT
     (SELECT count(*) FROM "User")        AS users,
     (SELECT count(*) FROM "Repository")  AS repos,
     (SELECT count(*) FROM "Metric")      AS metrics,
     (SELECT count(*) FROM "Session")     AS sessions;
   SQL
   Expected minimums: users=2, repos=6, metrics=18, sessions=2
   If any count is 0, print an error and stop

5. Print success summary:
   ✅ Database reset and seeded successfully
   📊 Run `npx prisma studio` to inspect data at http://localhost:5555
   🔑 Test credentials:
      alice@devpulse.dev / (SEED_PASSWORD env var, default: dev-only-seed-password)
      bob@devpulse.dev   / (SEED_PASSWORD env var, default: dev-only-seed-password)

## Success Criteria
- `npx prisma migrate reset --force` exits 0
- `npx prisma db seed` exits 0 and prints row counts
- All 4 tables have at least the minimum expected row counts
- No migration errors in output
