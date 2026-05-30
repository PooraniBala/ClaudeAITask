import { PrismaClient, MetricType, MetricPeriod } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const METRIC_TYPES: MetricType[] = [
  MetricType.COMMIT_FREQUENCY,
  MetricType.PR_STATS,
  MetricType.CONTRIBUTOR_ACTIVITY,
];

const METRIC_PERIODS: MetricPeriod[] = [
  MetricPeriod.SEVEN_DAYS,
  MetricPeriod.THIRTY_DAYS,
  MetricPeriod.NINETY_DAYS,
];

function periodToDays(period: MetricPeriod): number {
  if (period === MetricPeriod.SEVEN_DAYS) return 7;
  if (period === MetricPeriod.THIRTY_DAYS) return 30;
  return 90;
}

function buildPayload(type: MetricType, period: MetricPeriod): object {
  const days = periodToDays(period);

  if (type === MetricType.COMMIT_FREQUENCY) {
    const weeks = Math.ceil(days / 7);
    return {
      weeks: Array.from({ length: weeks }, (_, i) => ({
        week: new Date(Date.now() - (weeks - i) * 7 * 86_400_000)
          .toISOString()
          .split('T')[0],
        count: Math.floor(Math.random() * 20) + 1,
      })),
      total_days: days,
    };
  }

  if (type === MetricType.PR_STATS) {
    return {
      opened: Math.floor(Math.random() * 15) + 1,
      merged: Math.floor(Math.random() * 12) + 1,
      closed: Math.floor(Math.random() * 3),
      avg_merge_time_hours: Math.floor(Math.random() * 48) + 4,
      total_days: days,
    };
  }

  // CONTRIBUTOR_ACTIVITY
  return {
    contributors: [
      {
        login: 'dev-alpha',
        commits: Math.floor(Math.random() * 30) + 5,
        additions: Math.floor(Math.random() * 500) + 50,
        deletions: Math.floor(Math.random() * 200) + 10,
      },
      {
        login: 'dev-beta',
        commits: Math.floor(Math.random() * 20) + 2,
        additions: Math.floor(Math.random() * 300) + 20,
        deletions: Math.floor(Math.random() * 100) + 5,
      },
      {
        login: 'dev-gamma',
        commits: Math.floor(Math.random() * 10) + 1,
        additions: Math.floor(Math.random() * 150) + 10,
        deletions: Math.floor(Math.random() * 50) + 2,
      },
    ],
    total_days: days,
  };
}

async function main(): Promise<void> {
  // Clean up in reverse dependency order so FK constraints are satisfied
  await prisma.metric.deleteMany();
  await prisma.session.deleteMany();
  await prisma.repository.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  await prisma.$transaction(async (tx) => {
    const alice = await tx.user.create({
      data: {
        email: 'alice@devpulse.dev',
        password_hash: passwordHash,
        github_token: 'ghp_alice_seed_token_00000000000000000001',
      },
    });

    const bob = await tx.user.create({
      data: {
        email: 'bob@devpulse.dev',
        password_hash: passwordHash,
        github_token: 'ghp_bob_seed_token_000000000000000000001',
      },
    });

    const aliceRepos = await Promise.all([
      tx.repository.create({
        data: {
          github_id: 100_001,
          name: 'frontend-app',
          full_name: 'alice/frontend-app',
          url: 'https://github.com/alice/frontend-app',
          is_private: false,
          last_synced_at: new Date(),
          owner_id: alice.id,
        },
      }),
      tx.repository.create({
        data: {
          github_id: 100_002,
          name: 'api-service',
          full_name: 'alice/api-service',
          url: 'https://github.com/alice/api-service',
          is_private: false,
          last_synced_at: new Date(),
          owner_id: alice.id,
        },
      }),
      tx.repository.create({
        data: {
          github_id: 100_003,
          name: 'internal-tools',
          full_name: 'alice/internal-tools',
          url: 'https://github.com/alice/internal-tools',
          is_private: true,
          last_synced_at: new Date(),
          owner_id: alice.id,
        },
      }),
    ]);

    const bobRepos = await Promise.all([
      tx.repository.create({
        data: {
          github_id: 200_001,
          name: 'data-pipeline',
          full_name: 'bob/data-pipeline',
          url: 'https://github.com/bob/data-pipeline',
          is_private: false,
          last_synced_at: new Date(),
          owner_id: bob.id,
        },
      }),
      tx.repository.create({
        data: {
          github_id: 200_002,
          name: 'ml-models',
          full_name: 'bob/ml-models',
          url: 'https://github.com/bob/ml-models',
          is_private: true,
          last_synced_at: new Date(),
          owner_id: bob.id,
        },
      }),
      tx.repository.create({
        data: {
          github_id: 200_003,
          name: 'infra-config',
          full_name: 'bob/infra-config',
          url: 'https://github.com/bob/infra-config',
          is_private: true,
          last_synced_at: new Date(),
          owner_id: bob.id,
        },
      }),
    ]);

    const allRepos = [...aliceRepos, ...bobRepos];

    for (const repo of allRepos) {
      for (const type of METRIC_TYPES) {
        for (const period of METRIC_PERIODS) {
          await tx.metric.create({
            data: {
              repo_id: repo.id,
              type,
              period,
              payload: buildPayload(type, period),
              recorded_at: new Date(),
            },
          });
        }
      }
    }

    const sessionExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await tx.session.create({
      data: {
        user_id: alice.id,
        token: `devpulse_seed_session_alice_${Date.now()}`,
        expires_at: sessionExpiry,
      },
    });

    await tx.session.create({
      data: {
        user_id: bob.id,
        token: `devpulse_seed_session_bob_${Date.now()}`,
        expires_at: sessionExpiry,
      },
    });
  });

  const counts = await prisma.$transaction([
    prisma.user.count(),
    prisma.repository.count(),
    prisma.metric.count(),
    prisma.session.count(),
  ]);

  console.log(
    `Seed complete — users: ${counts[0]}, repos: ${counts[1]}, metrics: ${counts[2]}, sessions: ${counts[3]}`
  );
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
