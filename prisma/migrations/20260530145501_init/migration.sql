-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('COMMIT_FREQUENCY', 'PR_STATS', 'CONTRIBUTOR_ACTIVITY');

-- CreateEnum
CREATE TYPE "MetricPeriod" AS ENUM ('SEVEN_DAYS', 'THIRTY_DAYS', 'NINETY_DAYS');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "github_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "github_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "last_synced_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "owner_id" TEXT NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" TEXT NOT NULL,
    "repo_id" TEXT NOT NULL,
    "type" "MetricType" NOT NULL,
    "period" "MetricPeriod" NOT NULL,
    "payload" JSONB NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_github_id_key" ON "repositories"("github_id");

-- CreateIndex
CREATE INDEX "repositories_owner_id_idx" ON "repositories"("owner_id");

-- CreateIndex
CREATE INDEX "repositories_github_id_idx" ON "repositories"("github_id");

-- CreateIndex
CREATE INDEX "metrics_repo_id_type_period_idx" ON "metrics"("repo_id", "type", "period");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_repo_id_fkey" FOREIGN KEY ("repo_id") REFERENCES "repositories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
