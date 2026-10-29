-- CreateEnum
CREATE TYPE "CvStatus" AS ENUM ('generating', 'ready', 'failed');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('pdf', 'text');

-- CreateEnum
CREATE TYPE "GenerationKind" AS ENUM ('initial');

-- CreateEnum
CREATE TYPE "GenerationStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "GenerationStep" AS ENUM ('extract', 'compose');

-- CreateEnum
CREATE TYPE "GenerationErrorCode" AS ENUM ('ai_unavailable', 'invalid_ai_output', 'unreadable_source', 'timed_out', 'worker_lost', 'internal');

-- CreateTable
CREATE TABLE "Cv" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "targetRole" TEXT NOT NULL,
    "status" "CvStatus" NOT NULL,
    "content" JSONB,
    "facts" JSONB,
    "idempotencyKey" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Source" (
    "id" UUID NOT NULL,
    "cvId" UUID NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "fileName" TEXT,
    "bytes" BYTEA,
    "text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generation" (
    "id" UUID NOT NULL,
    "cvId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "GenerationKind" NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'queued',
    "step" "GenerationStep",
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "errorCode" "GenerationErrorCode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Generation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cv_ownerId_idempotencyKey_key" ON "Cv"("ownerId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Source_cvId_key" ON "Source"("cvId");

-- CreateIndex
CREATE INDEX "Generation_cvId_createdAt_idx" ON "Generation"("cvId", "createdAt");

-- CreateIndex
CREATE INDEX "Generation_userId_status_idx" ON "Generation"("userId", "status");

-- AddForeignKey
ALTER TABLE "Cv" ADD CONSTRAINT "Cv_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Source" ADD CONSTRAINT "Source_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generation" ADD CONSTRAINT "Generation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: what Prisma cannot express.

-- CV content is one JSON document (ADR 0001); the zod schema guards its shape.
ALTER TABLE "Cv" ADD CONSTRAINT "Cv_content_is_object"
  CHECK ("content" IS NULL OR jsonb_typeof("content") = 'object');

-- A Source is a PDF or free text, never both or neither.
ALTER TABLE "Source" ADD CONSTRAINT "Source_one_payload" CHECK (
  ("kind" = 'pdf' AND "bytes" IS NOT NULL AND "text" IS NULL) OR
  ("kind" = 'text' AND "text" IS NOT NULL AND "bytes" IS NULL)
);

-- At most one non-terminal Generation per CV.
CREATE UNIQUE INDEX "Generation_one_active_per_cv" ON "Generation"("cvId")
  WHERE "status" IN ('queued', 'running');
