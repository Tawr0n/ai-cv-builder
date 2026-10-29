-- AlterEnum
ALTER TYPE "GenerationKind" ADD VALUE 'answer';

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "answer" TEXT,
ADD COLUMN "appliedAt" TIMESTAMP(3),
ADD COLUMN "generationId" UUID;

-- CreateIndex
CREATE INDEX "Question_generationId_idx" ON "Question"("generationId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "Generation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- An applied Answer always has its text.
ALTER TABLE "Question" ADD CONSTRAINT "Question_applied_has_answer"
  CHECK ("appliedAt" IS NULL OR "answer" IS NOT NULL);
