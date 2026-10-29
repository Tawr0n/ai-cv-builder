-- AlterEnum
ALTER TYPE "GenerationStep" ADD VALUE 'judge';

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('open', 'answered', 'dismissed', 'obsolete');

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "cvId" UUID NOT NULL,
    "anchor" JSONB NOT NULL,
    "text" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'open',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_cvId_status_idx" ON "Question"("cvId", "status");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_cvId_fkey" FOREIGN KEY ("cvId") REFERENCES "Cv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hand-written: what Prisma cannot express.

-- The Anchor is one JSON object (zod `Anchor`).
ALTER TABLE "Question" ADD CONSTRAINT "Question_anchor_is_object"
  CHECK (jsonb_typeof("anchor") = 'object');
